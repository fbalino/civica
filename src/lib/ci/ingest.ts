import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as dsql } from "drizzle-orm";
import {
  jurisdictions,
  ciSourceIngestions,
  ciDimensionScores,
  ciMethodologyVersions,
} from "../db/schema";
import { markSourcesSynced } from "../db/source-freshness";
import { normalize, yearToQuarter } from "./normalize";
import type { IngestionResult } from "./types";
import { CI_INGEST_ALGORITHM_VERSION, ciVersionEnvelope } from "./versioning";
import type { StagedCiAdapter, StagedCiRow } from "./atomic-ingestion";
import { buildIndicatorLineage, frozenCiPublisherHash } from "@/lib/indicators/lineage";

export function createDb() {
  const sqlClient = neon(process.env.DATABASE_URL!);
  return drizzle({ client: sqlClient });
}

export type Db = ReturnType<typeof createDb>;

export async function buildIso3Map(db: Db): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: jurisdictions.id, iso3: jurisdictions.iso3 })
    .from(jurisdictions)
    .where(dsql`${jurisdictions.iso3} IS NOT NULL`);
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.iso3) map.set(r.iso3.toUpperCase(), r.id);
  }
  return map;
}

export async function getLatestMethodologyVersion(db: Db): Promise<string> {
  const rows = await db
    .select({ id: ciMethodologyVersions.id })
    .from(ciMethodologyVersions)
    .orderBy(dsql`${ciMethodologyVersions.publishedAt} DESC`)
    .limit(1);
  if (rows.length === 0) {
    throw new Error(
      "No methodology version found. Run seed-ci-methodology first.",
    );
  }
  return rows[0].id;
}

export async function runIngestion(
  db: Db,
  result: IngestionResult,
  opts?: {
    /**
     * Explicit timestamp to stamp on `sources.last_sync_at`. When the
     * seeder feeds frozen reference data (rather than a live pull) pass
     * the data vintage here (e.g. `new Date("2023-12-31")`) so the
     * freshness stamp reflects when the data was collected, not when the
     * seed script ran. Defaults to NOW() when omitted.
     */
    vintageAt?: Date;
    dryRun?: boolean;
    markSynced?: typeof markSourcesSynced;
  },
): Promise<{ ingested: number; skipped: number }> {
  const iso3Map = await buildIso3Map(db);
  const methodologyVersion = await getLatestMethodologyVersion(db);
  const quarter = yearToQuarter(result.datasetYear);
  const substitutionReason = result.sourceId === "worldbank_wgi" && result.dimension === "democratic_quality"
    ? "Coverage substitution where the primary V-Dem indicator has no jurisdiction row."
    : null;
  const lineage = buildIndicatorLineage({
    sourceId: result.sourceId,
    dimension: result.dimension,
    upstreamRelease: `${result.sourceId} ${result.datasetYear} release`,
    temporalCoverage: String(result.datasetYear),
    transformationId: `${CI_INGEST_ALGORITHM_VERSION}:${result.dimension}`,
    methodVersion: methodologyVersion,
    rows: result.records,
    publisherArtifactHash: frozenCiPublisherHash(result.sourceId, result.datasetYear),
    substitutionReason,
  });

  if (result.records.length === 0) {
    throw new Error(`${result.sourceId}/${result.dimension}: upstream produced zero records`);
  }

  if (opts?.dryRun) {
    let ingested = 0;
    let skipped = 0;
    for (const record of result.records) {
      if (!iso3Map.has(record.iso3.toUpperCase())) {
        skipped++;
        continue;
      }
      normalize(record.rawValue, result.globalMinObserved, result.globalMaxObserved, record.isInverted);
      ciVersionEnvelope({ methodologyVersion, algorithmVersion: CI_INGEST_ALGORITHM_VERSION, sourceIds: [result.sourceId] });
      ingested++;
    }
    await (opts.markSynced ?? markSourcesSynced)(result.sourceId, { rowsWritten: ingested, dryRun: true });
    return { ingested, skipped };
  }

  const stageFile = process.env.CI_INGEST_STAGE_FILE;
  if (stageFile) {
    const rows: StagedCiRow[] = [];
    let skipped = 0;
    for (const record of result.records) {
      const jurisdictionId = iso3Map.get(record.iso3.toUpperCase());
      if (!jurisdictionId) { skipped++; continue; }
      const normalizedScore = normalize(record.rawValue, result.globalMinObserved, result.globalMaxObserved, record.isInverted);
      const versions = ciVersionEnvelope({ methodologyVersion, algorithmVersion: CI_INGEST_ALGORITHM_VERSION, sourceIds: [result.sourceId] });
      rows.push({ jurisdictionId, iso3: record.iso3.toUpperCase(), normalizedScore, rawValue: record.rawValue, sourceId: result.sourceId, dimension: result.dimension, quarter, methodologyVersion, derivationVersionKey: versions.key, derivationVersions: versions.envelope, ...lineage });
    }
    if (rows.length === 0) throw new Error(`${result.sourceId}/${result.dimension}: staging produced zero matched rows`);
    const stage: StagedCiAdapter = {
      schemaVersion: "ci-atomic-stage/v1",
      adapterKey: `${result.sourceId}:${result.dimension}`,
      sourceId: result.sourceId,
      dimension: result.dimension,
      ...lineage,
      datasetYear: result.datasetYear,
      quarter,
      methodologyVersion,
      nativeScaleMin: result.records[0]?.nativeMin ?? 0,
      nativeScaleMax: result.records[0]?.nativeMax ?? 1,
      isInverted: result.records[0]?.isInverted ?? false,
      globalMinObserved: result.globalMinObserved,
      globalMaxObserved: result.globalMaxObserved,
      countriesCovered: rows.length,
      skipped,
      rows,
    };
    writeFileSync(stageFile, `${JSON.stringify(stage)}\n`, { flag: "wx" });
    return { ingested: rows.length, skipped };
  }

  const [ingestion] = await db
    .insert(ciSourceIngestions)
    .values({
      sourceId: result.sourceId,
      dimension: result.dimension,
      ...lineage,
      datasetYear: result.datasetYear,
      nativeScaleMin: result.records[0]?.nativeMin ?? 0,
      nativeScaleMax: result.records[0]?.nativeMax ?? 1,
      isInverted: result.records[0]?.isInverted ?? false,
      globalMinObserved: result.globalMinObserved,
      globalMaxObserved: result.globalMaxObserved,
      countriesCovered: result.records.length,
      status: "completed",
    })
    .onConflictDoUpdate({
      target: [
        ciSourceIngestions.sourceId,
        ciSourceIngestions.dimension,
        ciSourceIngestions.datasetYear,
        ciSourceIngestions.indicatorId,
      ],
      set: {
        globalMinObserved: result.globalMinObserved,
        globalMaxObserved: result.globalMaxObserved,
        countriesCovered: result.records.length,
        ...lineage,
        ingestedAt: dsql`NOW()`,
        status: "completed",
      },
    })
    .returning({ id: ciSourceIngestions.id });

  let ingested = 0;
  let skipped = 0;

  for (const record of result.records) {
    const jurisdictionId = iso3Map.get(record.iso3.toUpperCase());
    if (!jurisdictionId) {
      skipped++;
      continue;
    }

    const normalizedScore = normalize(
      record.rawValue,
      result.globalMinObserved,
      result.globalMaxObserved,
      record.isInverted,
    );
    const versions = ciVersionEnvelope({
      methodologyVersion,
      algorithmVersion: CI_INGEST_ALGORITHM_VERSION,
      sourceIds: [result.sourceId],
    });

    await db
      .insert(ciDimensionScores)
      .values({
        jurisdictionId,
        dimension: result.dimension,
        quarter,
        normalizedScore,
        rawValue: record.rawValue,
        sourceId: result.sourceId,
        ...lineage,
        ingestionId: ingestion.id,
        methodologyVersion,
        derivationVersionKey: versions.key,
        derivationVersions: versions.envelope,
      })
      .onConflictDoUpdate({
        target: [
          ciDimensionScores.jurisdictionId,
          ciDimensionScores.dimension,
          ciDimensionScores.quarter,
          ciDimensionScores.methodologyVersion,
          ciDimensionScores.sourceId,
          ciDimensionScores.indicatorId,
        ],
        set: {
          normalizedScore,
          rawValue: record.rawValue,
          sourceId: result.sourceId,
          ...lineage,
          ingestionId: ingestion.id,
          derivationVersionKey: versions.key,
          derivationVersions: versions.envelope,
        },
      });

    ingested++;
  }

  // Stamp source freshness only when this run actually wrote rows.
  // markSourcesSynced (src/lib/db/source-freshness.ts) is the one
  // sanctioned path and applies the stamp iff rowsWritten > 0.
  // Pass vintageAt when the data is a frozen snapshot so the stamp
  // reflects the data vintage rather than today's run date.
  await (opts?.markSynced ?? markSourcesSynced)(result.sourceId, {
    rowsWritten: ingested,
    dryRun: opts?.dryRun,
    ...(opts?.vintageAt ? { at: opts.vintageAt } : {}),
  });

  return { ingested, skipped };
}
