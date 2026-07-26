/**
 * Phase 5.5 — corroboration confidence for pulse_events_v2 rows.
 *
 * Implements spec §3.4 (asymmetric scoring — positive events require
 * stronger corroboration) + §3.5 (press-freedom-informed rules).
 *
 * For each pulse_events_v2 row, this pass:
 *   1. Groups source attributions by publisher family, declared origin,
 *      canonical URL, and republication similarity.
 *   2. Computes a diversity score from the remaining independent evidence
 *      groups (specialist groups weighted higher than news groups).
 *   3. Combines with classifier_agreement to produce a baseline
 *      corroboration_confidence in [0, 1].
 *   4. Applies the asymmetric rule for positive-direction events using
 *      the independent evidence-group count. State ownership is not yet
 *      represented by the current data model.
 *   5. Applies no information-environment multiplier in production while the
 *      candidate source is rights-blocked and the heuristic is unvalidated.
 *      A versioned context can be supplied only for sensitivity fixtures.
 *
 * Updates only — no inserts. Run after classify.ts.
 */

import { eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  jurisdictions,
  pulseEventsV2,
  pulsePipelineRuns,
  pulseSources,
  rawEvents,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { isPositiveTier } from "./taxonomy";
import {
  informationEnvironmentMultiplier,
  missingInformationEnvironmentContext,
  observedInformationEnvironmentContext,
  type PulseInformationEnvironmentContext,
} from "./press-freedom";
import type { ClassifierAgreement, SeverityTier } from "./types";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  loadPulsePipelineRunState,
  preparePulsePipelineRun,
  pulseCronStageRunId,
  pulseStageInputFingerprint,
  startPulsePipelineRun,
  type PulsePipelineRunRef,
} from "./pipeline-version";
import {
  deriveSourceIndependence,
  PULSE_SOURCE_INDEPENDENCE_VERSION,
  type SourceEvidenceReport,
} from "./source-independence";
import {
  persistPulseDecisions,
  preparePulseDecisionInsert,
} from "./decision-ledger-store";
import type { PulseDecisionInput } from "./decision-ledger";
import { PULSE_RUNTIME_METHOD_VERSION } from "./runtime-contract";

type Db = NeonHttpDatabase<typeof schema>;

export interface CorroborateSummary {
  runId: string;
  versionKey: string;
  examined: number;
  updated: number;
  averageConfidence: number;
  dryRun: boolean;
  /** True when a retry reused an already-completed deterministic stage run. */
  reused: boolean;
  planned: CorroborationPlan[];
}

export interface EventRow {
  id: string;
  incidentId?: string;
  clusterId: string;
  jurisdictionId: string;
  iso3: string | null;
  severityTier: SeverityTier;
  classifierAgreement: ClassifierAgreement;
  category: string;
  classificationRunId: string;
}

export interface SourceCounts {
  specialist: Set<string>;
  news: Set<string>;
  sourceIds?: Set<string>;
  reportCount?: number;
}

export interface CorroborationPlan {
  eventId: string;
  clusterId: string;
  confidence: number;
  informationEnvironmentContext: PulseInformationEnvironmentContext;
  corroborationRunId: string;
  sourceIndependenceVersion: typeof PULSE_SOURCE_INDEPENDENCE_VERSION;
  independentEvidenceGroups: number;
  contributingReports: number;
}

export interface CorroborateOptions {
  dryRun?: boolean;
  events?: EventRow[];
  sourceCounts?: ReadonlyMap<string, SourceCounts>;
  /** Fixture override keyed by event ID. Production loads the immutable pin. */
  informationContexts?: ReadonlyMap<string, PulseInformationEnvironmentContext>;
  informationContextMode?: "production" | "sensitivity";
  write?: (db: Db, plan: CorroborationPlan) => Promise<void>;
  now?: Date;
  runRef?: PulsePipelineRunRef;
  /** Stable logical cron delivery key injected by `withCronJob()`. */
  cronExecutionKey?: string;
  /** Integration-fixture seam for exercising the production atomic publish. */
  persistRun?: boolean;
}

export async function corroborateEvents(
  db: Db,
  opts: CorroborateOptions = {},
): Promise<CorroborateSummary> {
  const persistRun =
    !opts.dryRun && (opts.persistRun ?? (!opts.events && !opts.write));
  const cronRunId = opts.cronExecutionKey
    ? pulseCronStageRunId(opts.cronExecutionKey, "corroborate")
    : null;
  if (cronRunId && opts.runRef && opts.runRef.id !== cronRunId) {
    throw new Error(
      "corroboration runRef conflicts with the cron delivery identity",
    );
  }
  const existingRun =
    persistRun && cronRunId
      ? await loadPulsePipelineRunState(db, cronRunId, "corroborate")
      : null;
  if (existingRun?.status === "completed") {
    return {
      runId: existingRun.run.id,
      versionKey: existingRun.run.versionKey,
      examined: existingRun.counts.examined ?? 0,
      updated: existingRun.counts.updated ?? 0,
      averageConfidence: existingRun.counts.averageConfidence ?? 0,
      dryRun: false,
      reused: true,
      planned: [],
    };
  }
  if (existingRun && existingRun.status !== "running") {
    throw new Error(
      `Terminal Pulse pipeline run cannot be resumed: ${existingRun.run.id} (${existingRun.status})`,
    );
  }
  const selectionCutoff = existingRun?.startedAt ?? opts.now ?? new Date();
  const persistedEventIds = existingRun?.run.versions.inputIds?.map((id) =>
    id.startsWith("event:") ? id.slice("event:".length) : id,
  );
  if (existingRun && !persistedEventIds) {
    throw new Error(
      `Running corroboration run lacks an input snapshot: ${existingRun.run.id}`,
    );
  }
  const loadedEvents =
    opts.events ??
    (await loadEvents(db, selectionCutoff, persistedEventIds ?? null));
  const events = persistedEventIds
    ? loadedEvents.filter((event) => persistedEventIds.includes(event.id))
    : loadedEvents;
  if (
    persistedEventIds &&
    (events.length !== persistedEventIds.length ||
      events.some((event) => !persistedEventIds.includes(event.id)))
  ) {
    throw new Error(
      `Corroboration retry input snapshot is incomplete: ${existingRun!.run.id}`,
    );
  }
  validateEvents(events);
  const informationContexts =
    opts.informationContexts ?? (await loadInformationContexts(db, events));
  const resolvedCounts = new Map<string, SourceCounts>();
  for (const event of events) {
    const fixtureCounts = opts.sourceCounts?.get(event.id);
    if (opts.sourceCounts && !fixtureCounts)
      throw new Error(`missing source-count fixture for event: ${event.id}`);
    resolvedCounts.set(
      event.id,
      fixtureCounts ??
        (await loadSourceCounts(db, event.id, selectionCutoff)),
    );
  }
  const inputFingerprint = pulseStageInputFingerprint({
    events: [...events].sort((a, b) => a.id.localeCompare(b.id)),
    sourceCounts: [...resolvedCounts]
      .map(([eventId, counts]) => ({
        eventId,
        specialist: [...counts.specialist].sort(),
        news: [...counts.news].sort(),
        sourceIds: [...(counts.sourceIds ?? [])].sort(),
        reportCount: counts.reportCount ?? null,
      }))
      .sort((a, b) => a.eventId.localeCompare(b.eventId)),
    informationContexts: [...informationContexts]
      .sort(([a], [b]) => a.localeCompare(b)),
  });
  if (
    existingRun &&
    existingRun.run.versions.inputFingerprint !== inputFingerprint
  ) {
    throw new Error(
      `Corroboration retry input values changed: ${existingRun.run.id}`,
    );
  }
  const run =
    existingRun?.run ??
    opts.runRef ??
    createPulsePipelineRunRef("corroborate", {
      id: cronRunId ?? undefined,
      sourceIds: events.length
        ? [...resolvedCounts.values()].flatMap((counts) => [
            ...(counts.sourceIds ?? counts.specialist),
            ...(counts.sourceIds ? [] : counts.news),
          ])
        : undefined,
      upstreamRunIds: events.map(
        ({ classificationRunId }) => classificationRunId,
      ),
      inputIds: events.map(({ id }) => `event:${id}`),
      inputFingerprint,
    });
  if (persistRun) {
    const prepared = existingRun
      ? await preparePulsePipelineRun(db, run)
      : cronRunId
        ? (await startPulsePipelineRun(db, run, {
            startedAt: selectionCutoff,
          }),
          { state: "ready" as const })
        : await preparePulsePipelineRun(db, run);
    if (prepared.state === "completed") {
      return {
        runId: run.id,
        versionKey: run.versionKey,
        examined: prepared.counts.examined ?? events.length,
        updated: prepared.counts.updated ?? 0,
        averageConfidence: prepared.counts.averageConfidence ?? 0,
        dryRun: false,
        reused: true,
        planned: [],
      };
    }
  }

  let updated = 0;
  let totalConfidence = 0;
  const planned: CorroborationPlan[] = [];
  const now = selectionCutoff;

  for (const event of events) {
    const counts = resolvedCounts.get(event.id)!;
    const informationContext =
      informationContexts.get(event.id) ??
      missingInformationEnvironmentContext(
        "No immutable classification-time context pin exists.",
      );
    if (!informationContexts.has(event.id)) {
      throw new Error(`missing information-context pin for event: ${event.id}`);
    }

    let confidence = baselineConfidence(counts, event.classifierAgreement);

    // Asymmetric scoring (spec §3.4)
    if (isPositiveTier(event.severityTier)) {
      // Positive events without specialist corroboration get penalised
      if (counts.specialist.size === 0) confidence *= 0.6;
    }

    confidence *= informationEnvironmentMultiplier({
      context: informationContext,
      isPositive: isPositiveTier(event.severityTier),
      specialistGroups: counts.specialist.size,
      newsGroups: counts.news.size,
      mode: opts.informationContextMode ?? "production",
    });

    confidence = Math.max(0, Math.min(1, confidence));
    totalConfidence += confidence;
    const plan = {
      eventId: event.id,
      clusterId: event.clusterId,
      confidence,
      informationEnvironmentContext: informationContext,
      corroborationRunId: run.id,
      sourceIndependenceVersion: PULSE_SOURCE_INDEPENDENCE_VERSION,
      independentEvidenceGroups: counts.specialist.size + counts.news.size,
      contributingReports:
        counts.reportCount ?? counts.specialist.size + counts.news.size,
    };
    planned.push(plan);
    if (!opts.dryRun && !persistRun) {
      if (opts.write) await opts.write(db, plan);
      else await writeCorroboration(db, plan, now);
      updated++;
    }
  }

  if (persistRun) {
    const averageConfidence = events.length
      ? totalConfidence / events.length
      : 0;
    const counts = {
      examined: events.length,
      updated: planned.length,
      averageConfidence,
      contributingReports: [...resolvedCounts.values()].reduce(
        (sum, counts) =>
          sum +
          (counts.reportCount ?? counts.specialist.size + counts.news.size),
        0,
      ),
      independentEvidenceGroups: [...resolvedCounts.values()].reduce(
        (sum, counts) => sum + counts.specialist.size + counts.news.size,
        0,
      ),
    };
    const eventQueries = planned.map((plan) =>
      corroborationEventUpdateQuery(db, plan, now),
    );
    const decisions = preparePulseDecisionInsert(
      db,
      planned.map((plan) => corroborationDecisionInput(plan, now)),
    );
    // Use the database clock in production so a small application/database
    // clock skew cannot make a run appear to complete before it started.
    const completedAt = opts.now ?? sql`CURRENT_TIMESTAMP`;
    const batchQueries = [
      ...eventQueries,
      ...(decisions.query ? [decisions.query] : []),
      db
        .update(pulsePipelineRuns)
        .set({
          status: "completed",
          counts,
          failures: [],
          completedAt,
        })
        .where(eq(pulsePipelineRuns.id, run.id)),
    ] as unknown as Parameters<typeof db.batch>[0];
    try {
      await db.batch(batchQueries);
      updated = planned.length;
    } catch (error) {
      if (!opts.cronExecutionKey) {
        await finishPulsePipelineRun(db, run.id, {
          status: "failed",
          counts: { ...counts, updated: 0 },
          failures: [
            {
              component: "pulse_corroboration_publish",
              message:
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : "Unknown atomic corroboration failure",
            },
          ],
        });
      }
      throw error;
    }
  }

  return {
    runId: run.id,
    versionKey: run.versionKey,
    examined: events.length,
    updated,
    averageConfidence: events.length ? totalConfidence / events.length : 0,
    dryRun: opts.dryRun ?? false,
    reused: false,
    planned: planned.sort((a, b) => a.eventId.localeCompare(b.eventId)),
  };
}

function validateEvents(events: EventRow[]): void {
  const ids = new Set<string>();
  for (const event of events) {
    if (!event.id.trim() || !event.jurisdictionId.trim())
      throw new Error(
        "corroboration fixture has a blank event or jurisdiction id",
      );
    if (!event.classificationRunId.trim())
      throw new Error(
        `corroboration fixture has no classification run: ${event.id}`,
      );
    if (ids.has(event.id))
      throw new Error(`duplicate corroboration event id: ${event.id}`);
    ids.add(event.id);
  }
}

async function writeCorroboration(
  db: Db,
  plan: CorroborationPlan,
  now: Date,
): Promise<void> {
  await corroborationEventUpdateQuery(db, plan, now);
  await persistPulseDecisions(db, [corroborationDecisionInput(plan, now)]);
}

function corroborationEventUpdateQuery(
  db: Db,
  plan: CorroborationPlan,
  now: Date,
) {
  return db
    .update(pulseEventsV2)
    .set({
      corroborationConfidence: plan.confidence,
      updatedAt: now,
      corroborationRunId: plan.corroborationRunId,
    })
    .where(eq(pulseEventsV2.id, plan.eventId));
}

function corroborationDecisionInput(
  plan: CorroborationPlan,
  now: Date,
): PulseDecisionInput<"corroboration"> {
  return {
    clusterId: plan.clusterId,
    eventId: plan.eventId,
    kind: "corroboration",
    verdict: "affirmed",
    payload: {
      independentEvidenceGroups: plan.independentEvidenceGroups,
      contributingReports: plan.contributingReports,
      confidenceWeight: plan.confidence,
      calibrationStanding: "heuristic_not_probability",
    },
    actor: {
      type: "corroborator",
      provider: null,
      model: null,
      reviewerId: null,
    },
    stageRunId: plan.corroborationRunId,
    methodVersion: PULSE_RUNTIME_METHOD_VERSION,
    rationale:
      "Versioned source-independence rules produced a heuristic corroboration weight; it is not a calibrated probability.",
    evidenceRefs: [
      `event:${plan.eventId}`,
      `source-independence:${plan.sourceIndependenceVersion}`,
      ...(plan.informationEnvironmentContext.sourceUrl
        ? [plan.informationEnvironmentContext.sourceUrl]
        : []),
    ],
    decidedAt: now.toISOString(),
  };
}

function baselineConfidence(
  counts: SourceCounts,
  agreement: ClassifierAgreement,
): number {
  // Source-diversity score: specialist=1.0, news=0.6, with cap.
  const specWeight = Math.min(counts.specialist.size, 3) * 0.25;
  const newsWeight = Math.min(counts.news.size, 4) * 0.1;
  const diversity = Math.min(1, specWeight + newsWeight);

  const agreementBoost =
    agreement === "all" ? 0.2 : agreement === "two_of_three" ? 0.0 : -0.3;

  // Floor at 0.2 so a single specialist source still contributes
  // something to scoring.
  const base = 0.4 + diversity * 0.4 + agreementBoost;
  return Math.max(0, Math.min(1, base));
}

async function loadEvents(
  db: Db,
  selectionCutoff: Date,
  eventIds: readonly string[] | null,
): Promise<EventRow[]> {
  const eventPredicate = eventIds
    ? eventIds.length
      ? sql`p.id IN (${sql.join(
          eventIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`
      : sql`false`
    : sql`true`;
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.incident_id,
      p.cluster_id,
      p.jurisdiction_id,
      j.iso3,
      p.severity_tier,
      p.classifier_agreement,
      p.category,
      p.classification_run_id
    FROM pulse_events_v2 p
    JOIN jurisdictions j ON j.id = p.jurisdiction_id
    WHERE ${eventPredicate}
      AND p.projection_status = 'current'
      AND p.created_at <= ${selectionCutoff}
      AND EXISTS (
        SELECT 1
        FROM pulse_cluster_classification_states classification_state
        WHERE classification_state.event_id = p.id
          AND classification_state.cluster_id = p.cluster_id
          AND classification_state.last_run_id = p.classification_run_id
          AND classification_state.status = 'classified'
      )
    ORDER BY p.id
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    incidentId: String(r.incident_id),
    clusterId: String(r.cluster_id),
    jurisdictionId: String(r.jurisdiction_id),
    iso3: r.iso3 ? String(r.iso3) : null,
    severityTier: r.severity_tier as SeverityTier,
    classifierAgreement: r.classifier_agreement as ClassifierAgreement,
    category: String(r.category),
    classificationRunId: String(r.classification_run_id),
  }));
}

async function loadInformationContexts(
  db: Db,
  events: readonly EventRow[],
): Promise<Map<string, PulseInformationEnvironmentContext>> {
  if (events.length === 0) return new Map();
  const ids = events.map(({ id }) => id);
  const result = await db.execute(sql`
    SELECT
      pin.event_id,
      pin.value_status,
      pin.score,
      pin.missing_reason,
      pin.source_id,
      pin.source_url,
      pin.upstream_release,
      pin.observation_year,
      pin.retrieved_at,
      pin.content_sha256,
      pin.rights_status,
      pin.use_status,
      release.publisher_rows,
      release.matched_jurisdictions,
      release.supported_jurisdictions
    FROM pulse_event_information_environment_pins pin
    LEFT JOIN pulse_information_environment_releases release
      ON release.release_id = pin.release_id
    WHERE pin.event_id IN (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
  `);
  const rows =
    (result as unknown as { rows?: Array<Record<string, unknown>> }).rows ??
    (result as unknown as Array<Record<string, unknown>>);
  return new Map(
    rows.map((row) => {
      const release = row.source_id
        ? {
            sourceId: String(row.source_id),
            sourceUrl: String(row.source_url),
            upstreamRelease: String(row.upstream_release),
            observationYear: Number(row.observation_year),
            retrievedAt: new Date(String(row.retrieved_at)).toISOString(),
            contentSha256: String(row.content_sha256),
            publisherRows: Number(row.publisher_rows),
            matchedJurisdictions: Number(row.matched_jurisdictions),
            supportedJurisdictions: Number(row.supported_jurisdictions),
            rightsStatus: row.rights_status as "verified" | "pending",
            useStatus: row.use_status as
              | "active_unvalidated_heuristic"
              | "disabled_pending_rights_and_validation",
          }
        : undefined;
      const context =
        row.value_status === "observed" && release
          ? observedInformationEnvironmentContext({
              score: Number(row.score),
              ...release,
            })
          : missingInformationEnvironmentContext(
              String(
                row.missing_reason ?? "Classification-time context is missing.",
              ),
              release,
            );
      return [String(row.event_id), context] as const;
    }),
  );
}

async function loadSourceCounts(
  db: Db,
  eventId: string,
  selectionCutoff: Date,
): Promise<SourceCounts> {
  const result = await db.execute(sql`
    SELECT
      ps.source_id,
      ps.source_type,
      ps.raw_event_id,
      ps.source_url,
      r.title,
      r.body,
      r.evidence_publisher
    FROM pulse_events_v2 current_event
    JOIN pulse_events_v2 evidence_event
      ON evidence_event.incident_id = current_event.incident_id
    JOIN pulse_sources ps ON ps.event_id = evidence_event.id
    JOIN raw_events r ON r.id = ps.raw_event_id
    WHERE current_event.id = ${eventId}
      AND (ps.created_at IS NULL OR ps.created_at <= ${selectionCutoff})
    ORDER BY ps.raw_event_id
  `);
  const rows = ((result as unknown as { rows?: unknown[] }).rows ??
    result) as Array<Record<string, unknown>>;

  return sourceCountsFromEvidence(
    rows.map((row) => ({
      rawEventId: String(row.raw_event_id),
      sourceId: String(row.source_id),
      sourceType: row.source_type as "specialist" | "news",
      sourceUrl: row.source_url ? String(row.source_url) : null,
      sourceFamilyId: (row.evidence_publisher as { sourceFamilyId: string })
        .sourceFamilyId,
      itemPublisherHost: (
        row.evidence_publisher as { itemPublisherHost: string }
      ).itemPublisherHost,
      title: String(row.title),
      body: row.body ? String(row.body) : null,
    })),
  );
}

export function sourceCountsFromEvidence(
  reports: readonly SourceEvidenceReport[],
): SourceCounts {
  const independence = deriveSourceIndependence(reports);
  const out: SourceCounts = {
    specialist: new Set(),
    news: new Set(),
    sourceIds: new Set(reports.map(({ sourceId }) => sourceId)),
    reportCount: reports.length,
  };
  for (const group of independence.groups) {
    if (group.sourceType === "specialist") out.specialist.add(group.id);
    else out.news.add(group.id);
  }
  return out;
}

// Suppress unused (kept for potential future direct lookups)
void jurisdictions;
