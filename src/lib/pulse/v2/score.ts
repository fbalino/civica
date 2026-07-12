/**
 * Phase 5.5 — Pulse v2 dimensional delta scoring.
 *
 * For each (country, dimension), sum the decayed impacts of all
 * `published=true` pulse_events_v2 rows in the trailing 365-day
 * window. Clamp to [-15, +10] per spec §4.3. Upsert into
 * `pulse_dimensional_deltas`.
 *
 * The trailing window is 365 days. Category decay is applied only inside that
 * window, so configured half-lives longer than the window are truncated when
 * the event ages out.
 */

import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { pulseDimensionalDeltas } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { decayedImpact, daysSince } from "./decay";
import {
  DELTA_LOWER_BOUND,
  DELTA_UPPER_BOUND,
  SCORE_WINDOW_DAYS,
} from "./taxonomy";
import { PULSE_DIMENSIONS, type PulseDimension } from "./types";
import { isPulseClassificationValid } from "./review-validation";
import { pulseDeltaVersionEnvelope } from "./versioning";
import type { DerivationVersionEnvelope } from "@/lib/research/derivation-version";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
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
  /** distinct (country, dimension) tuples with non-trivial deltas (|δ| ≥ 1) */
  significantDeltas: number;
  dryRun: boolean;
  planned: DimensionalDeltaPlan[];
}

export interface PublishedEvent {
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
}

export interface DimensionalDeltaPlan {
  jurisdictionId: string;
  dimension: PulseDimension;
  deltaValue: number;
  contributingEventIds: string[];
  derivationVersionKey: string;
  derivationVersions: DerivationVersionEnvelope;
  computationRunId: string;
}

export interface ScoreOptions {
  dryRun?: boolean;
  events?: PublishedEvent[];
  existingJurisdictionIds?: string[];
  write?: (db: Db, plan: DimensionalDeltaPlan) => Promise<void>;
  now?: Date;
  runRef?: PulsePipelineRunRef;
}

export async function calculateDimensionalDeltas(
  db: Db,
  options: ScoreOptions = {},
): Promise<ScoreSummary> {
  const today = options.now ?? new Date();
  const windowStart = new Date(
    today.getTime() - SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const events = options.events ?? await loadPublishedEvents(db, windowStart);
  validatePublishedEvents(events);
  const run =
    options.runRef ??
    createPulsePipelineRunRef("score", {
      sourceIds: events.length
        ? events.flatMap(({ sourceIds }) => sourceIds)
        : undefined,
      upstreamRunIds: events.flatMap(
        ({ publicationRunId, corroborationRunId }) => [
          publicationRunId,
          corroborationRunId,
        ],
      ),
    });
  const persistRun = !options.dryRun && !options.events && !options.runRef;
  if (persistRun) await startPulsePipelineRun(db, run);
  const existingJurisdictionIds = options.existingJurisdictionIds ?? await loadExistingJurisdictionIds(db);

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
      e.corroborationConfidence,
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
      };
      planned.push(plan);
      if (!options.dryRun) {
        if (options.write) await options.write(db, plan);
        else await writeDimensionalDelta(db, plan, today);
        written++;
      }
      if (Math.abs(clamped) >= 1) significant++;
    }
  }

  if (persistRun) {
    await finishPulsePipelineRun(db, run.id, {
      status: "completed",
      counts: {
        eventsConsidered: events.length,
        countriesScored: countriesSeen.size,
        dimensionRowsWritten: written,
        significantDeltas: significant,
      },
    });
  }

  return {
    runId: run.id,
    versionKey: run.versionKey,
    eventsConsidered: events.length,
    countriesScored: countriesSeen.size,
    dimensionRowsWritten: written,
    significantDeltas: significant,
    dryRun: options.dryRun ?? false,
    planned: planned.sort((a, b) => `${a.jurisdictionId}:${a.dimension}`.localeCompare(`${b.jurisdictionId}:${b.dimension}`)),
  };
}

function validatePublishedEvents(events: PublishedEvent[]): void {
  const ids = new Set<string>();
  for (const event of events) {
    if (!event.id.trim() || !event.jurisdictionId.trim()) throw new Error("score fixture has a blank event or jurisdiction id");
    if (!event.publicationRunId.trim()) throw new Error(`score fixture has no publication run: ${event.id}`);
    if (!event.corroborationRunId.trim()) throw new Error(`score fixture has no corroboration run: ${event.id}`);
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

async function writeDimensionalDelta(db: Db, plan: DimensionalDeltaPlan, now: Date): Promise<void> {
  await db
    .insert(pulseDimensionalDeltas)
    .values({
      jurisdictionId: plan.jurisdictionId,
      dimension: plan.dimension,
      deltaValue: plan.deltaValue,
      contributingEventIds: plan.contributingEventIds,
      derivationVersionKey: plan.derivationVersionKey,
      derivationVersions: plan.derivationVersions,
      computationRunId: plan.computationRunId,
    })
    .onConflictDoUpdate({
      target: [pulseDimensionalDeltas.jurisdictionId, pulseDimensionalDeltas.dimension],
      set: {
        deltaValue: plan.deltaValue,
        contributingEventIds: plan.contributingEventIds,
        derivationVersionKey: plan.derivationVersionKey,
        derivationVersions: plan.derivationVersions,
        computationRunId: plan.computationRunId,
        lastComputedAt: now,
      },
    });
}

async function loadPublishedEvents(
  db: Db,
  sinceDate: string
): Promise<PublishedEvent[]> {
  const result = await db.execute(sql`
    SELECT
      id,
      jurisdiction_id,
      dimension,
      category,
      severity_tier,
      severity_value,
      corroboration_confidence,
      event_date,
      derivation_versions,
      publication_run_id,
      corroboration_run_id,
      ARRAY(
        SELECT DISTINCT ps.source_id
        FROM pulse_sources ps
        JOIN pulse_events_v2 source_event ON source_event.id = ps.event_id
        WHERE source_event.incident_id = pulse_events_v2.incident_id
        ORDER BY ps.source_id
      ) AS source_ids
    FROM pulse_events_v2
    WHERE published = true
      AND projection_status = 'current'
      AND publication_run_id IS NOT NULL
      AND corroboration_run_id IS NOT NULL
      AND review_status IN ('approved', 'edited')
      AND category <> 'none'
      AND event_date >= ${sinceDate}
      AND event_date <= CURRENT_DATE
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;
  return (rows as Array<Record<string, unknown>>)
    .map((r) => ({
      id: String(r.id),
      jurisdictionId: String(r.jurisdiction_id),
      dimension: r.dimension as PulseDimension,
      category: String(r.category),
      severityTier: String(r.severity_tier),
      severityValue: Number(r.severity_value),
      corroborationConfidence: Number(r.corroboration_confidence),
      eventDate: String(r.event_date),
      derivationVersions: r.derivation_versions as DerivationVersionEnvelope,
      publicationRunId: String(r.publication_run_id),
      corroborationRunId: String(r.corroboration_run_id),
      sourceIds: Array.isArray(r.source_ids) ? r.source_ids.map(String) : [],
    }))
    .filter((event) => isPulseClassificationValid(event));
}
