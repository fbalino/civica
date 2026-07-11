import { createHash } from "node:crypto";
import { stableStringify } from "@/lib/data/frozen-vintage";
import { normalize } from "./normalize";
import { computeOne } from "./calculate-v2";
import { CURRENT_CI_METHODOLOGY_VERSION, CURRENT_CI_QUARTER, CURRENT_CI_VINTAGE_LABEL } from "./current-release";
import type { IngestionResult } from "./types";
import { indicatorIdFor } from "@/lib/indicators/lineage";

export interface CiSpineRow { id: string; name: string; iso3: string }
export interface ReproducedDimensionRow { jurisdictionId: string; iso3: string; dimension: string; indicatorId: string; sourceId: string; rawValue: number; normalizedScore: number; quarter: string; methodologyVersion: string }
export interface ReproducedCompositeRow { jurisdictionId: string; iso3: string; score: number; scoreLower: null; scoreUpper: null; completenessFlag: string; rank: number; totalRanked: number; isPartial: boolean; dimensionsAvailable: number; missingDimensions: string[]; quarter: string; methodologyVersion: string; vintageLabel: string }

function hashRows(rows: readonly unknown[]): string {
  return createHash("sha256").update(stableStringify(rows)).digest("hex");
}

/**
 * PostgreSQL `real` is IEEE-754 float32, but its text protocol returns the
 * shortest decimal that round-trips to that float. Drizzle then parses that
 * decimal back into a JavaScript number. Reproduction must cross the same
 * storage boundary because the persisted raw value is part of the release
 * seed; Math.fround alone retains a longer JavaScript binary expansion.
 */
export function postgresRealRoundTrip(value: number): number {
  const stored = Math.fround(value);
  for (let significantDigits = 1; significantDigits <= 9; significantDigits++) {
    const candidate = Number(stored.toPrecision(significantDigits));
    if (Math.fround(candidate) === stored) return candidate;
  }
  return Number(stored.toPrecision(9));
}

export function reproduceCurrentCiRelease(spine: readonly CiSpineRow[], inputs: readonly IngestionResult[]) {
  const byIso3 = new Map(spine.map((row) => [row.iso3.toUpperCase(), row]));
  const dimensions: ReproducedDimensionRow[] = [];
  for (const input of inputs) for (const record of input.records) {
    const jurisdiction = byIso3.get(record.iso3.toUpperCase());
    if (!jurisdiction) continue;
    dimensions.push({
      jurisdictionId: jurisdiction.id, iso3: jurisdiction.iso3.toUpperCase(), dimension: record.dimension,
      indicatorId: indicatorIdFor(input.sourceId, record.dimension), sourceId: input.sourceId, rawValue: postgresRealRoundTrip(record.rawValue),
      normalizedScore: postgresRealRoundTrip(normalize(record.rawValue, input.globalMinObserved, input.globalMaxObserved, record.isInverted)),
      quarter: CURRENT_CI_QUARTER, methodologyVersion: CURRENT_CI_METHODOLOGY_VERSION,
    });
  }
  dimensions.sort((a, b) => `${a.iso3}:${a.dimension}:${a.sourceId}:${a.indicatorId}`.localeCompare(`${b.iso3}:${b.dimension}:${b.sourceId}:${b.indicatorId}`));
  const grouped = new Map<string, ReproducedDimensionRow[]>();
  for (const row of dimensions) grouped.set(row.jurisdictionId, [...(grouped.get(row.jurisdictionId) ?? []), row]);
  const computed: Array<ReturnType<typeof computeOne> & { iso3: string }> = [];
  for (const rows of grouped.values()) {
    const ordered = [...rows].sort((a, b) => `${a.dimension}:${a.sourceId}`.localeCompare(`${b.dimension}:${b.sourceId}`));
    const result = computeOne(ordered);
    if (result) computed.push(Object.assign(result, { iso3: ordered[0].iso3 }));
  }
  computed.sort((a, b) => b!.scoreInteger - a!.scoreInteger || a!.jurisdictionId.localeCompare(b!.jurisdictionId));
  const composites: ReproducedCompositeRow[] = computed.map((row, index) => ({
    jurisdictionId: row!.jurisdictionId, iso3: row!.iso3, score: row!.scoreInteger, scoreLower: row!.scoreLower,
    scoreUpper: row!.scoreUpper, completenessFlag: row!.completeness, rank: index + 1, totalRanked: computed.length,
    isPartial: row!.completeness === "partial", dimensionsAvailable: row!.dimensionsAvailable,
    missingDimensions: [...row!.missingDimensions], quarter: CURRENT_CI_QUARTER,
    methodologyVersion: CURRENT_CI_METHODOLOGY_VERSION, vintageLabel: CURRENT_CI_VINTAGE_LABEL,
  }));
  return { dimensions, composites, dimensionSha256: hashRows(dimensions), compositeSha256: hashRows(composites) };
}
