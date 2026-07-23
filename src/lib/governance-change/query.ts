import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  indicatorHistory,
  jurisdictions,
  sources,
} from "@/lib/db/schema";
import type { GovernanceChangeObservation } from "./explorer";

export interface GovernanceChangeDataset {
  observations: GovernanceChangeObservation[];
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
  sourceLastSyncAt: string | null;
  upstreamReleases: string[];
  methodVersions: string[];
  artifactHashes: string[];
  years: number[];
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export async function getGovernanceChangeDataset(
  sourceId: string,
  indicator: string,
): Promise<GovernanceChangeDataset> {
  const rows = await db
    .select({
      jurisdictionId: jurisdictions.id,
      jurisdictionName: jurisdictions.name,
      jurisdictionSlug: jurisdictions.slug,
      year: indicatorHistory.year,
      value: indicatorHistory.value,
      nativeMin: indicatorHistory.nativeMin,
      nativeMax: indicatorHistory.nativeMax,
      isInverted: indicatorHistory.isInverted,
      upstreamRelease: indicatorHistory.upstreamRelease,
      methodVersion: indicatorHistory.methodVersion,
      artifactHash: indicatorHistory.artifactHash,
      sourceLastSyncAt: sources.lastSyncAt,
    })
    .from(indicatorHistory)
    .innerJoin(
      jurisdictions,
      eq(indicatorHistory.jurisdictionId, jurisdictions.id),
    )
    .innerJoin(sources, eq(indicatorHistory.sourceId, sources.id))
    .where(
      and(
        eq(indicatorHistory.sourceId, sourceId),
        eq(indicatorHistory.indicator, indicator),
        eq(jurisdictions.type, "sovereign_state"),
        inArray(indicatorHistory.valueStatus, ["observed", "disputed"]),
      ),
    )
    .orderBy(asc(jurisdictions.name), asc(indicatorHistory.year));
  const observed = rows.filter(
    (row): row is typeof row & { value: number } => row.value !== null,
  );
  const first = observed[0];
  return {
    observations: observed.map((row) => ({
      jurisdictionId: row.jurisdictionId,
      jurisdictionName: row.jurisdictionName,
      jurisdictionSlug: row.jurisdictionSlug,
      year: row.year,
      value: row.value,
    })),
    nativeMin: first?.nativeMin ?? 0,
    nativeMax: first?.nativeMax ?? 0,
    isInverted: first?.isInverted ?? false,
    sourceLastSyncAt: iso(first?.sourceLastSyncAt ?? null),
    upstreamReleases: [
      ...new Set(observed.map((row) => row.upstreamRelease)),
    ].sort(),
    methodVersions: [
      ...new Set(observed.map((row) => row.methodVersion)),
    ].sort(),
    artifactHashes: [
      ...new Set(observed.map((row) => row.artifactHash)),
    ].sort(),
    years: [...new Set(observed.map((row) => row.year))].sort(
      (a, b) => a - b,
    ),
  };
}
