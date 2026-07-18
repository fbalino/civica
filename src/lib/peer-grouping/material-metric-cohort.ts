/**
 * Material metric peer cohorts.
 *
 * Country-metric rows are the Conditions/material comparison surface. Their
 * universe is therefore the sovereign jurisdictions with an observed value for
 * the selected metric and cutoff year — never every stored jurisdiction and
 * never a governance taxonomy cohort.
 */

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { getPeerSetForMeasure, type PeerSetResult } from "@/lib/peer-grouping";

export interface MaterialMetricPeerCohort {
  metricId: string;
  observationYear: number;
  peerSet: PeerSetResult;
  values: number[];
}

interface ObservedMetricRow {
  jurisdictionId: string;
  value: number;
  observationYear: number;
}

function rowsFrom(result: unknown): ObservedMetricRow[] {
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  return (rows as Array<Record<string, unknown>>)
    .filter(
      (row): row is Record<string, unknown> & ObservedMetricRow =>
        typeof row.jurisdictionId === "string" &&
        typeof row.value === "number" &&
        Number.isFinite(row.value) &&
        typeof row.observationYear === "number",
    )
    .map((row) => ({
      jurisdictionId: row.jurisdictionId,
      value: Number(row.value),
      observationYear: Number(row.observationYear),
    }));
}

/**
 * Resolve one material metric cohort at a declared cutoff. Each jurisdiction
 * contributes its latest observed value at or before that cutoff. The subject
 * itself must be observed; otherwise the peer resolver returns the explicit
 * `subject_not_observed` state.
 */
export async function getMaterialMetricPeerCohort(args: {
  jurisdictionId: string;
  metricId: string;
  year: number;
}): Promise<MaterialMetricPeerCohort | null> {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (cm.jurisdiction_id)
      cm.jurisdiction_id AS "jurisdictionId",
      cm.value,
      cm.year AS "observationYear"
    FROM country_metrics cm
    JOIN jurisdictions j ON j.id = cm.jurisdiction_id
    WHERE cm.metric_id = ${args.metricId}
      AND cm.year <= ${args.year}
      AND cm.value_status = 'observed'
      AND cm.value IS NOT NULL
      AND j.type = 'sovereign_state'
    ORDER BY cm.jurisdiction_id, cm.year DESC
  `);
  const observed = rowsFrom(result);
  const subject = observed.find(
    (row) => row.jurisdictionId === args.jurisdictionId,
  );
  if (!subject) return null;

  const peerSet = await getPeerSetForMeasure({
    jurisdictionId: args.jurisdictionId,
    measureDomain: "material",
    metricId: args.metricId,
    metricVintage: String(subject.observationYear),
    eligibleJurisdictionIds: observed.map((row) => row.jurisdictionId),
  });
  const cohortIds = new Set(peerSet.peerJurisdictionIds);

  return {
    metricId: args.metricId,
    observationYear: subject.observationYear,
    peerSet,
    values: observed
      .filter((row) => cohortIds.has(row.jurisdictionId))
      .map((row) => row.value),
  };
}

export function materialPeerBand(cohort: MaterialMetricPeerCohort): {
  peerCount: number;
  peerMin: number;
  peerMedian: number;
  peerMax: number;
  attemptedN: number;
  finalN: number;
  eligibleN: number;
  cohortLabel: string;
  fallbackChain: PeerSetResult["fallbackChain"];
  upstreamVintage: string | null;
  sourceId: string;
  retrievedAt: string | null;
} | null {
  const values = [...cohort.values].sort((a, b) => a - b);
  if (values.length === 0 || !cohort.peerSet.available) return null;
  const midpoint = (values.length - 1) / 2;
  const lower = Math.floor(midpoint);
  const upper = Math.ceil(midpoint);
  const peerMedian =
    lower === upper ? values[lower] : (values[lower] + values[upper]) / 2;
  return {
    peerCount: values.length,
    peerMin: values[0],
    peerMedian,
    peerMax: values.at(-1) ?? values[0],
    attemptedN: cohort.peerSet.attemptedN,
    finalN: cohort.peerSet.finalN,
    eligibleN: cohort.peerSet.eligibleN,
    cohortLabel: cohort.peerSet.cohortLabel,
    fallbackChain: cohort.peerSet.fallbackChain,
    upstreamVintage: cohort.peerSet.upstreamVintage,
    sourceId: cohort.peerSet.sourceId,
    retrievedAt: cohort.peerSet.retrievedAt,
  };
}
