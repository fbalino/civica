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
  pulseSources,
  rawEvents,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { isPositiveTier } from "./taxonomy";
import {
  informationEnvironmentMultiplier,
  missingInformationEnvironmentContext,
  type PulseInformationEnvironmentContext,
} from "./press-freedom";
import type { ClassifierAgreement, SeverityTier } from "./types";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  startPulsePipelineRun,
  type PulsePipelineRunRef,
} from "./pipeline-version";
import {
  deriveSourceIndependence,
  PULSE_SOURCE_INDEPENDENCE_VERSION,
  type SourceEvidenceReport,
} from "./source-independence";
import { persistPulseDecisions } from "./decision-ledger-store";
import { PULSE_RUNTIME_METHOD_VERSION } from "./runtime-contract";

type Db = NeonHttpDatabase<typeof schema>;

export interface CorroborateSummary {
  runId: string;
  versionKey: string;
  examined: number;
  updated: number;
  averageConfidence: number;
  dryRun: boolean;
  planned: CorroborationPlan[];
}

export interface EventRow {
  id: string;
  clusterId: string;
  jurisdictionId: string;
  iso3: string | null;
  severityTier: SeverityTier;
  classifierAgreement: ClassifierAgreement;
  category: string;
  pressPinned: number | null;
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
  onlyUnpinned?: boolean;
  dryRun?: boolean;
  events?: EventRow[];
  sourceCounts?: ReadonlyMap<string, SourceCounts>;
  informationContexts?: ReadonlyMap<string, PulseInformationEnvironmentContext>;
  informationContextMode?: "production" | "sensitivity";
  write?: (db: Db, plan: CorroborationPlan) => Promise<void>;
  now?: Date;
  runRef?: PulsePipelineRunRef;
}

export async function corroborateEvents(
  db: Db,
  opts: CorroborateOptions = {},
): Promise<CorroborateSummary> {
  const events = opts.events ?? (await loadEvents(db, opts));
  validateEvents(events);
  const resolvedCounts = new Map<string, SourceCounts>();
  for (const event of events) {
    const fixtureCounts = opts.sourceCounts?.get(event.id);
    if (opts.sourceCounts && !fixtureCounts)
      throw new Error(`missing source-count fixture for event: ${event.id}`);
    resolvedCounts.set(
      event.id,
      fixtureCounts ?? (await loadSourceCounts(db, event.id)),
    );
  }
  const run =
    opts.runRef ??
    createPulsePipelineRunRef("corroborate", {
      sourceIds: events.length
        ? [...resolvedCounts.values()].flatMap((counts) => [
            ...(counts.sourceIds ?? counts.specialist),
            ...(counts.sourceIds ? [] : counts.news),
          ])
        : undefined,
      upstreamRunIds: events.map(
        ({ classificationRunId }) => classificationRunId,
      ),
    });
  const persistRun = !opts.dryRun && !opts.events && !opts.runRef;
  if (persistRun) await startPulsePipelineRun(db, run);

  let updated = 0;
  let totalConfidence = 0;
  const planned: CorroborationPlan[] = [];

  for (const event of events) {
    const counts = resolvedCounts.get(event.id)!;
    const informationContext =
      opts.informationContexts?.get(event.jurisdictionId) ??
      missingInformationEnvironmentContext(
        "No rights-cleared, versioned production context is registered.",
      );
    if (
      opts.informationContexts &&
      !opts.informationContexts.has(event.jurisdictionId)
    ) {
      throw new Error(
        `missing information-context fixture for jurisdiction: ${event.jurisdictionId}`,
      );
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
    if (!opts.dryRun) {
      if (opts.write) await opts.write(db, plan);
      else await writeCorroboration(db, plan, opts.now ?? new Date());
      updated++;
    }
  }

  if (persistRun) {
    await finishPulsePipelineRun(db, run.id, {
      status: "completed",
      counts: {
        examined: events.length,
        updated,
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
      },
    });
  }

  return {
    runId: run.id,
    versionKey: run.versionKey,
    examined: events.length,
    updated,
    averageConfidence: events.length ? totalConfidence / events.length : 0,
    dryRun: opts.dryRun ?? false,
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
  await db
    .update(pulseEventsV2)
    .set({
      corroborationConfidence: plan.confidence,
      updatedAt: now,
      corroborationRunId: plan.corroborationRunId,
    })
    .where(eq(pulseEventsV2.id, plan.eventId));
  await persistPulseDecisions(db, [
    {
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
    },
  ]);
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
  opts: { onlyUnpinned?: boolean },
): Promise<EventRow[]> {
  const where = opts.onlyUnpinned
    ? sql`p.press_freedom_score_at_classification IS NULL`
    : sql`TRUE`;

  const result = await db.execute(sql`
    SELECT
      p.id,
      p.cluster_id,
      p.jurisdiction_id,
      j.iso3,
      p.severity_tier,
      p.classifier_agreement,
      p.category,
      p.press_freedom_score_at_classification AS press_pinned
      ,p.classification_run_id
    FROM pulse_events_v2 p
    JOIN jurisdictions j ON j.id = p.jurisdiction_id
    WHERE ${where}
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    clusterId: String(r.cluster_id),
    jurisdictionId: String(r.jurisdiction_id),
    iso3: r.iso3 ? String(r.iso3) : null,
    severityTier: r.severity_tier as SeverityTier,
    classifierAgreement: r.classifier_agreement as ClassifierAgreement,
    category: String(r.category),
    pressPinned: r.press_pinned !== null ? Number(r.press_pinned) : null,
    classificationRunId: String(r.classification_run_id),
  }));
}

async function loadSourceCounts(
  db: Db,
  eventId: string,
): Promise<SourceCounts> {
  const rows = await db
    .select({
      sourceId: pulseSources.sourceId,
      sourceType: pulseSources.sourceType,
      rawEventId: pulseSources.rawEventId,
      sourceUrl: pulseSources.sourceUrl,
      title: rawEvents.title,
      body: rawEvents.body,
      evidencePublisher: rawEvents.evidencePublisher,
    })
    .from(pulseSources)
    .innerJoin(rawEvents, eq(rawEvents.id, pulseSources.rawEventId))
    .where(eq(pulseSources.eventId, eventId));

  return sourceCountsFromEvidence(
    rows.map((row) => ({
      rawEventId: row.rawEventId,
      sourceId: row.sourceId,
      sourceType: row.sourceType as "specialist" | "news",
      sourceUrl: row.sourceUrl,
      sourceFamilyId: row.evidencePublisher.sourceFamilyId,
      itemPublisherHost: row.evidencePublisher.itemPublisherHost,
      title: row.title,
      body: row.body,
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
