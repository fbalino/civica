/**
 * Phase 5.5 — Pulse v2 dimensional delta scoring.
 *
 * For each (country, dimension), sum the decayed impacts of all
 * `published=true` pulse_events_v2 rows in the trailing window derived from
 * the longest declared category half-life. Clamp to [-15, +10] per spec §4.3. Upsert into
 * `pulse_dimensional_deltas`.
 *
 * Category decay is applied through every configured half-life. A separate
 * lifecycle guard admits only current, published, reviewed event projections;
 * persistence is never inferred and later recurrences require new events.
 */

import { eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  pulseDimensionalDeltaHistory,
  pulseDimensionalDeltas,
  pulsePipelineRuns,
  pulseScorePublicationPointers,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { decayedImpact, daysSince } from "./decay";
import {
  DELTA_LOWER_BOUND,
  DELTA_UPPER_BOUND,
  SCORE_WINDOW_DAYS,
} from "./taxonomy";
import { PULSE_DIMENSIONS, type PulseDimension } from "./types";
import { isPulseClassificationValid } from "./review-validation";
import {
  isScoreableEventLifecycle,
  type ScoreLifecycleEvent,
} from "./event-lifecycle";
import { pulseDeltaVersionEnvelope } from "./versioning";
import type { DerivationVersionEnvelope } from "@/lib/research/derivation-version";
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

type Db = NeonHttpDatabase<typeof schema>;

export interface ScoreSummary {
  runId: string;
  versionKey: string;
  eventsConsidered: number;
  countriesScored: number;
  dimensionRowsWritten: number;
  /** Events excluded by a current append-only absorption decision. */
  absorbedEventsExcluded: number;
  /** distinct (country, dimension) tuples with non-trivial deltas (|δ| ≥ 1) */
  significantDeltas: number;
  dryRun: boolean;
  /** True when a retry reused an already-completed deterministic stage run. */
  reused: boolean;
  planned: DimensionalDeltaPlan[];
}

export interface PublishedEvent extends ScoreLifecycleEvent {
  id: string;
  jurisdictionId: string;
  dimension: PulseDimension;
  category: string;
  severityTier: string;
  severityValue: number;
  corroborationConfidence: number;
  eventDate: string;
  derivationVersions: DerivationVersionEnvelope;
  sourceIds: string[];
  publicationRunId: string;
  corroborationRunId: string;
  absorptionDecisionKey: string | null;
  absorptionOutcome: "absorbed" | "not_absorbed" | null;
}

export interface DimensionalDeltaPlan {
  jurisdictionId: string;
  dimension: PulseDimension;
  deltaValue: number;
  contributingEventIds: string[];
  derivationVersionKey: string;
  derivationVersions: DerivationVersionEnvelope;
  computationRunId: string;
  scoreAsOf: string;
  windowStart: string;
  windowDays: number;
}

export interface ScoreOptions {
  dryRun?: boolean;
  events?: PublishedEvent[];
  existingJurisdictionIds?: string[];
  write?: (db: Db, plan: DimensionalDeltaPlan) => Promise<void>;
  now?: Date;
  runRef?: PulsePipelineRunRef;
  /** Stable logical cron delivery key injected by `withCronJob()`. */
  cronExecutionKey?: string;
  /** Integration-fixture seam for exercising the production atomic publish. */
  persistRun?: boolean;
}

export async function calculateDimensionalDeltas(
  db: Db,
  options: ScoreOptions = {},
): Promise<ScoreSummary> {
  const persistRun =
    !options.dryRun &&
    (options.persistRun ?? (!options.events && !options.write));
  const cronRunId = options.cronExecutionKey
    ? pulseCronStageRunId(options.cronExecutionKey, "score")
    : null;
  if (cronRunId && options.runRef && options.runRef.id !== cronRunId) {
    throw new Error("score runRef conflicts with the cron delivery identity");
  }
  const existingRun =
    persistRun && cronRunId
      ? await loadPulsePipelineRunState(db, cronRunId, "score")
      : null;
  if (existingRun?.status === "completed") {
    return {
      runId: existingRun.run.id,
      versionKey: existingRun.run.versionKey,
      eventsConsidered: existingRun.counts.eventsConsidered ?? 0,
      countriesScored: existingRun.counts.countriesScored ?? 0,
      dimensionRowsWritten:
        existingRun.counts.dimensionRowsWritten ?? 0,
      significantDeltas: existingRun.counts.significantDeltas ?? 0,
      absorbedEventsExcluded:
        existingRun.counts.absorbedEventsExcluded ?? 0,
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
  const today = existingRun?.startedAt ?? options.now ?? new Date();
  const windowStart = new Date(
    today.getTime() - SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const persistedInputIds = existingRun?.run.versions.inputIds;
  if (existingRun && !persistedInputIds) {
    throw new Error(
      `Running score run lacks an input snapshot: ${existingRun.run.id}`,
    );
  }
  const persistedEventIds = (persistedInputIds ?? [])
    .filter((id) => id.startsWith("event:"))
    .map((id) => id.slice("event:".length));
  const persistedJurisdictionIds = (persistedInputIds ?? [])
    .filter((id) => id.startsWith("jurisdiction:"))
    .map((id) => id.slice("jurisdiction:".length));
  const loadedEvents =
    options.events ??
    (await loadPublishedEvents(
      db,
      windowStart,
      today.toISOString().slice(0, 10),
      today,
      existingRun ? persistedEventIds : null,
    ));
  const candidateEvents = existingRun
    ? loadedEvents.filter((event) => persistedEventIds.includes(event.id))
    : loadedEvents;
  if (
    existingRun &&
    (candidateEvents.length !== persistedEventIds.length ||
      candidateEvents.some((event) => !persistedEventIds.includes(event.id)))
  ) {
    throw new Error(
      `Score retry input snapshot is incomplete: ${existingRun.run.id}`,
    );
  }
  validatePublishedEvents(candidateEvents);
  const todayDate = today.toISOString().slice(0, 10);
  // Enforce the window in the pure scorer as well as its SQL loader. This
  // keeps fixtures, replays, and future callers from reviving an aged-out or
  // future event by supplying a preloaded array that bypasses the query.
  const events = candidateEvents.filter(
    (event) => event.eventDate >= windowStart && event.eventDate <= todayDate,
  );
  const existingJurisdictionIds = existingRun
    ? persistedJurisdictionIds
    : options.existingJurisdictionIds ??
      (await loadExistingJurisdictionIds(db));
  if (existingJurisdictionIds.some((id) => !id.trim())) {
    throw new Error("score fixture has a blank existing jurisdiction id");
  }
  const inputFingerprint = pulseStageInputFingerprint({
    scoreAsOf: todayDate,
    events: [...events].sort((a, b) => a.id.localeCompare(b.id)),
    existingJurisdictionIds: [...existingJurisdictionIds].sort(),
  });
  if (
    existingRun &&
    existingRun.run.versions.inputFingerprint !== inputFingerprint
  ) {
    throw new Error(`Score retry input values changed: ${existingRun.run.id}`);
  }
  const run =
    existingRun?.run ??
    options.runRef ??
    createPulsePipelineRunRef("score", {
      id: cronRunId ?? undefined,
      sourceIds: events.length
        ? events.flatMap(({ sourceIds }) => sourceIds)
        : undefined,
      upstreamRunIds: events.flatMap(
        ({ publicationRunId, corroborationRunId }) => [
          publicationRunId,
          corroborationRunId,
        ],
      ),
      inputIds: [
        ...events.map(({ id }) => `event:${id}`),
        ...existingJurisdictionIds.map((id) => `jurisdiction:${id}`),
      ],
      inputFingerprint,
    });
  if (persistRun) {
    const prepared = existingRun
      ? await preparePulsePipelineRun(db, run)
      : cronRunId
        ? (await startPulsePipelineRun(db, run, { startedAt: today }),
          { state: "ready" as const })
        : await preparePulsePipelineRun(db, run);
    if (prepared.state === "completed") {
      return {
        runId: run.id,
        versionKey: run.versionKey,
        eventsConsidered: prepared.counts.eventsConsidered ?? events.length,
        countriesScored: prepared.counts.countriesScored ?? 0,
        dimensionRowsWritten:
          prepared.counts.dimensionRowsWritten ?? 0,
        significantDeltas: prepared.counts.significantDeltas ?? 0,
        absorbedEventsExcluded:
          prepared.counts.absorbedEventsExcluded ?? 0,
        dryRun: false,
        reused: true,
        planned: [],
      };
    }
  }
  // Bucket by (jurisdictionId, dimension)
  type Key = string; // `${jurisdictionId}::${dimension}`
  const buckets = new Map<
    Key,
    {
      totalImpact: number;
      eventIds: string[];
      versionEnvelopes: DerivationVersionEnvelope[];
      sourceIds: string[];
    }
  >();

  for (const e of events) {
    const days = daysSince(e.eventDate, today);
    const impact = decayedImpact(
      e.severityValue,
      e.absorptionOutcome === "absorbed" ? 0 : e.corroborationConfidence,
      days,
      e.category
    );
    const key = `${e.jurisdictionId}::${e.dimension}`;
    const bucket = buckets.get(key) ?? {
      totalImpact: 0,
      eventIds: [],
      versionEnvelopes: [],
      sourceIds: [],
    };
    bucket.totalImpact += impact;
    if (Math.abs(impact) >= 0.1) bucket.eventIds.push(e.id);
    bucket.versionEnvelopes.push(e.derivationVersions);
    bucket.sourceIds.push(...e.sourceIds);
    buckets.set(key, bucket);
  }

  let written = 0;
  let significant = 0;
  const countriesSeen = new Set<string>();
  const planned: DimensionalDeltaPlan[] = [];

  // Walk every (country, dim) to clear stale rows where all events
  // have decayed away. Pull all jurisdictionIds with any event in
  // the window first.
  for (const e of events) countriesSeen.add(e.jurisdictionId);
  for (const jurisdictionId of existingJurisdictionIds) {
    countriesSeen.add(jurisdictionId);
  }

  for (const jurisdictionId of countriesSeen) {
    for (const dim of PULSE_DIMENSIONS) {
      const key = `${jurisdictionId}::${dim}`;
      const bucket = buckets.get(key);
      const totalImpact = bucket?.totalImpact ?? 0;
      const clamped = Math.max(
        DELTA_LOWER_BOUND,
        Math.min(DELTA_UPPER_BOUND, totalImpact)
      );
      const eventIds = bucket?.eventIds ?? [];
      const versions = pulseDeltaVersionEnvelope(
        bucket?.versionEnvelopes ?? [],
        bucket?.sourceIds ?? [],
      );

      const plan = {
        jurisdictionId,
        dimension: dim,
        deltaValue: clamped,
        contributingEventIds: eventIds,
        derivationVersionKey: versions.key,
        derivationVersions: versions.envelope,
        computationRunId: run.id,
        scoreAsOf: todayDate,
        windowStart,
        windowDays: SCORE_WINDOW_DAYS,
      };
      planned.push(plan);
      if (Math.abs(clamped) >= 1) significant++;
    }
  }

  if (!options.dryRun) {
    if (options.write) {
      for (const plan of planned) {
        await options.write(db, plan);
        written++;
      }
    } else if (persistRun) {
      const counts = {
        eventsConsidered: events.length,
        countriesScored: countriesSeen.size,
        dimensionRowsWritten: planned.length,
        significantDeltas: significant,
        absorbedEventsExcluded: events.filter(
          (event) => event.absorptionOutcome === "absorbed",
        ).length,
      };
      try {
        const completeRun = db
          .update(pulsePipelineRuns)
          .set({
            status: "completed",
            counts,
            failures: [],
            completedAt: today,
          })
          .where(eq(pulsePipelineRuns.id, run.id));
        const publishRun = db
          .insert(pulseScorePublicationPointers)
          .values({
            product: "pulse_dimensions",
            computationRunId: run.id,
            versionKey: run.versionKey,
            scoreAsOf: todayDate,
            publishedAt: today,
          })
          .onConflictDoUpdate({
            target: pulseScorePublicationPointers.product,
            set: {
              computationRunId: run.id,
              versionKey: run.versionKey,
              scoreAsOf: todayDate,
              publishedAt: today,
            },
          });
        const batchQueries = [
          ...planned.flatMap((plan) =>
            dimensionalDeltaWriteQueries(db, plan, today),
          ),
          completeRun,
          // Publication is the last statement. Neon applies the batch
          // atomically, so a pointer failure preserves the prior release and
          // rolls back the history/projection/run close together.
          publishRun,
        ] as unknown as Parameters<typeof db.batch>[0];
        // neon-http exposes atomic transactions through batch(); its callback
        // transaction API deliberately throws. The batch contains every
        // immutable output, current projection, and successful run close.
        await db.batch(batchQueries);
        written = planned.length;
      } catch (error) {
        if (!options.cronExecutionKey) {
          await finishPulsePipelineRun(db, run.id, {
            status: "failed",
            counts: { ...counts, dimensionRowsWritten: 0 },
            failures: [
              {
                component: "pulse_dimensional_delta_history",
                message:
                  error instanceof Error
                    ? error.message.slice(0, 500)
                    : "Unknown atomic score write failure",
              },
            ],
          });
        }
        throw error;
      }
    } else {
      for (const plan of planned) {
        await writeDimensionalDelta(db, plan, today);
        written++;
      }
    }
  }

  return {
    runId: run.id,
    versionKey: run.versionKey,
    eventsConsidered: events.length,
    countriesScored: countriesSeen.size,
    dimensionRowsWritten: written,
    significantDeltas: significant,
    absorbedEventsExcluded: events.filter(
      (event) => event.absorptionOutcome === "absorbed",
    ).length,
    dryRun: options.dryRun ?? false,
    reused: false,
    planned: planned.sort((a, b) => `${a.jurisdictionId}:${a.dimension}`.localeCompare(`${b.jurisdictionId}:${b.dimension}`)),
  };
}

function validatePublishedEvents(events: PublishedEvent[]): void {
  const ids = new Set<string>();
  for (const event of events) {
    if (!event.id.trim() || !event.jurisdictionId.trim()) throw new Error("score fixture has a blank event or jurisdiction id");
    if (!event.publicationRunId.trim()) throw new Error(`score fixture has no publication run: ${event.id}`);
    if (!event.corroborationRunId.trim()) throw new Error(`score fixture has no corroboration run: ${event.id}`);
    if (!isScoreableEventLifecycle(event)) {
      throw new Error(`score fixture has an ineligible event lifecycle: ${event.id}`);
    }
    if (event.absorptionOutcome === "absorbed" && !event.absorptionDecisionKey)
      throw new Error(`score fixture has absorbed status without decision evidence: ${event.id}`);
    if (!PULSE_DIMENSIONS.includes(event.dimension)) throw new Error(`score fixture has an invalid dimension: ${event.dimension}`);
    if (!Number.isFinite(event.severityValue) || !Number.isFinite(event.corroborationConfidence)) throw new Error(`score fixture has invalid numeric input: ${event.id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.eventDate)) throw new Error(`score fixture has an invalid event date: ${event.id}`);
    if (ids.has(event.id)) throw new Error(`duplicate score event id: ${event.id}`);
    ids.add(event.id);
  }
}

async function loadExistingJurisdictionIds(db: Db): Promise<string[]> {
  const result = await db.execute(sql`SELECT DISTINCT jurisdiction_id FROM pulse_dimensional_deltas`);
  return (((result as unknown as { rows?: unknown[] }).rows ?? result) as Array<Record<string, unknown>>)
    .map((row) => String(row.jurisdiction_id));
}

function dimensionalDeltaWriteQueries(
  db: Db,
  plan: DimensionalDeltaPlan,
  now: Date,
) {
  const history = db.insert(pulseDimensionalDeltaHistory).values({
    schemaVersion: "pulse-dimensional-delta-history/v1",
    jurisdictionId: plan.jurisdictionId,
    dimension: plan.dimension,
    deltaValue: plan.deltaValue,
    contributingEventIds: plan.contributingEventIds,
    derivationVersionKey: plan.derivationVersionKey,
    derivationVersions: plan.derivationVersions,
    computationRunId: plan.computationRunId,
    scoreAsOf: plan.scoreAsOf,
    windowStart: plan.windowStart,
    windowDays: plan.windowDays,
  });
  const projection = db
    .insert(pulseDimensionalDeltas)
    .values({
      jurisdictionId: plan.jurisdictionId,
      dimension: plan.dimension,
      deltaValue: plan.deltaValue,
      contributingEventIds: plan.contributingEventIds,
      derivationVersionKey: plan.derivationVersionKey,
      derivationVersions: plan.derivationVersions,
      computationRunId: plan.computationRunId,
      scoreAsOf: plan.scoreAsOf,
      windowStart: plan.windowStart,
      windowDays: plan.windowDays,
      lastComputedAt: now,
    })
    .onConflictDoUpdate({
      target: [pulseDimensionalDeltas.jurisdictionId, pulseDimensionalDeltas.dimension],
      set: {
        deltaValue: plan.deltaValue,
        contributingEventIds: plan.contributingEventIds,
        derivationVersionKey: plan.derivationVersionKey,
        derivationVersions: plan.derivationVersions,
        computationRunId: plan.computationRunId,
        scoreAsOf: plan.scoreAsOf,
        windowStart: plan.windowStart,
        windowDays: plan.windowDays,
        lastComputedAt: now,
      },
    });
  return [history, projection] as const;
}

async function writeDimensionalDelta(
  db: Db,
  plan: DimensionalDeltaPlan,
  now: Date,
): Promise<void> {
  const [history, projection] = dimensionalDeltaWriteQueries(db, plan, now);
  await history;
  await projection;
}

async function loadPublishedEvents(
  db: Db,
  sinceDate: string,
  throughDate: string,
  selectionCutoff: Date,
  eventIds: readonly string[] | null,
): Promise<PublishedEvent[]> {
  const eventPredicate = eventIds
    ? eventIds.length
      ? sql`pulse_events_v2.id IN (${sql.join(
          eventIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`
      : sql`false`
    : sql`true`;
  const result = await db.execute(sql`
    SELECT
      pulse_events_v2.id,
      pulse_events_v2.jurisdiction_id,
      pulse_events_v2.dimension,
      pulse_events_v2.category,
      pulse_events_v2.projection_status,
      pulse_events_v2.published,
      pulse_events_v2.review_status,
      pulse_events_v2.severity_tier,
      pulse_events_v2.severity_value,
      pulse_events_v2.corroboration_confidence,
      pulse_events_v2.event_date,
      pulse_events_v2.derivation_versions,
      pulse_events_v2.publication_run_id,
      pulse_events_v2.corroboration_run_id,
      absorption.absorption_key,
      absorption.outcome AS absorption_outcome,
      ARRAY(
        SELECT DISTINCT ps.source_id
        FROM pulse_sources ps
        JOIN pulse_events_v2 source_event ON source_event.id = ps.event_id
        WHERE source_event.incident_id = pulse_events_v2.incident_id
          AND (ps.created_at IS NULL OR ps.created_at <= ${selectionCutoff})
        ORDER BY ps.source_id
      ) AS source_ids
    FROM pulse_events_v2
    LEFT JOIN LATERAL (
      SELECT a.absorption_key, a.outcome
      FROM pulse_event_absorptions a
      WHERE a.event_id = pulse_events_v2.id
        AND a.as_of <= ${throughDate}
        AND a.decided_at <= ${selectionCutoff}
      ORDER BY a.as_of DESC, a.decided_at DESC, a.absorption_key DESC
      LIMIT 1
    ) absorption ON true
    JOIN pulse_pipeline_runs publication_run
      ON publication_run.id = pulse_events_v2.publication_run_id
    JOIN pulse_pipeline_runs corroboration_run
      ON corroboration_run.id = pulse_events_v2.corroboration_run_id
     AND corroboration_run.status = 'completed'
    WHERE ${eventPredicate}
      AND pulse_events_v2.published = true
      AND pulse_events_v2.projection_status = 'current'
      AND pulse_events_v2.review_status IN ('approved', 'edited')
      AND pulse_events_v2.category <> 'none'
      AND pulse_events_v2.publication_run_id IS NOT NULL
      AND pulse_events_v2.corroboration_run_id IS NOT NULL
      AND (
        publication_run.status = 'completed'
        OR EXISTS (
          SELECT 1
          FROM pulse_cluster_classification_states classification_state
          WHERE classification_state.event_id = pulse_events_v2.id
            AND classification_state.cluster_id = pulse_events_v2.cluster_id
            AND classification_state.last_run_id = pulse_events_v2.publication_run_id
            AND classification_state.status = 'classified'
        )
      )
      AND pulse_events_v2.created_at <= ${selectionCutoff}
      AND pulse_events_v2.event_date >= ${sinceDate}
      AND pulse_events_v2.event_date <= ${throughDate}
    ORDER BY pulse_events_v2.id
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;
  return (rows as Array<Record<string, unknown>>)
    .map((r): PublishedEvent => ({
      id: String(r.id),
      jurisdictionId: String(r.jurisdiction_id),
      dimension: r.dimension as PulseDimension,
      category: String(r.category),
      projectionStatus: r.projection_status as PublishedEvent["projectionStatus"],
      published: Boolean(r.published),
      reviewStatus: r.review_status as PublishedEvent["reviewStatus"],
      severityTier: String(r.severity_tier),
      severityValue: Number(r.severity_value),
      corroborationConfidence: Number(r.corroboration_confidence),
      eventDate: String(r.event_date),
      derivationVersions: r.derivation_versions as DerivationVersionEnvelope,
      publicationRunId: String(r.publication_run_id),
      corroborationRunId: String(r.corroboration_run_id),
      absorptionDecisionKey: r.absorption_key
        ? String(r.absorption_key)
        : null,
      absorptionOutcome:
        r.absorption_outcome === "absorbed" ||
        r.absorption_outcome === "not_absorbed"
          ? r.absorption_outcome
          : null,
      sourceIds: Array.isArray(r.source_ids) ? r.source_ids.map(String) : [],
    }))
    .filter((event) => isPulseClassificationValid(event));
}
