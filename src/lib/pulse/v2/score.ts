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

type Db = NeonHttpDatabase<typeof schema>;

export interface ScoreSummary {
  eventsConsidered: number;
  countriesScored: number;
  dimensionRowsWritten: number;
  /** distinct (country, dimension) tuples with non-trivial deltas (|δ| ≥ 1) */
  significantDeltas: number;
}

interface PublishedEvent {
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
}

export async function calculateDimensionalDeltas(
  db: Db
): Promise<ScoreSummary> {
  const today = new Date();
  const windowStart = new Date(
    today.getTime() - SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const events = await loadPublishedEvents(db, windowStart);
  const existingDeltaRows = await db.execute(sql`
    SELECT DISTINCT jurisdiction_id
    FROM pulse_dimensional_deltas
  `);
  const existingJurisdictionIds = (
    ((existingDeltaRows as unknown as { rows?: unknown[] }).rows ??
      existingDeltaRows) as Array<Record<string, unknown>>
  ).map((row) => String(row.jurisdiction_id));

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

      await db
        .insert(pulseDimensionalDeltas)
        .values({
          jurisdictionId,
          dimension: dim,
          deltaValue: clamped,
          contributingEventIds: eventIds,
          derivationVersionKey: versions.key,
          derivationVersions: versions.envelope,
        })
        .onConflictDoUpdate({
          target: [
            pulseDimensionalDeltas.jurisdictionId,
            pulseDimensionalDeltas.dimension,
          ],
          set: {
            deltaValue: clamped,
            contributingEventIds: eventIds,
            derivationVersionKey: versions.key,
            derivationVersions: versions.envelope,
            lastComputedAt: new Date(),
          },
        });
      written++;
      if (Math.abs(clamped) >= 1) significant++;
    }
  }

  return {
    eventsConsidered: events.length,
    countriesScored: countriesSeen.size,
    dimensionRowsWritten: written,
    significantDeltas: significant,
  };
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
      ARRAY(
        SELECT DISTINCT ps.source_id
        FROM pulse_sources ps
        WHERE ps.event_id = pulse_events_v2.id
        ORDER BY ps.source_id
      ) AS source_ids
    FROM pulse_events_v2
    WHERE published = true
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
      sourceIds: Array.isArray(r.source_ids) ? r.source_ids.map(String) : [],
    }))
    .filter((event) => isPulseClassificationValid(event));
}
