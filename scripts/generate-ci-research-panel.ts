import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import {
  CI_RESEARCH_PANEL_END_YEAR,
  CI_RESEARCH_PANEL_GENERATOR_VERSION,
  CI_RESEARCH_PANEL_INDICATORS,
  CI_RESEARCH_PANEL_RELEASE_ID,
  CI_RESEARCH_PANEL_RIGHTS_POSTURE,
  CI_RESEARCH_PANEL_SCHEMA_VERSION,
  CI_RESEARCH_PANEL_START_YEAR,
  CI_RESEARCH_PANEL_TEMPORAL_BREAKS,
  panelMissingReason,
  researchPanelHash,
} from "../src/lib/ci/research-panel";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const write = process.argv.includes("--write");

interface JurisdictionRow { id: string; iso3: string; name: string }
interface HistoryRow {
  jurisdictionId: string; sourceId: string; indicatorId: string; periodYear: number;
  value: number; upstreamRelease: string; artifactHash: string;
}

const outputDir = `data/releases/${CI_RESEARCH_PANEL_RELEASE_ID}`;

async function main() {
  const jurisdictions = await sql`
    SELECT id::text, iso3, name FROM jurisdictions
    WHERE type = 'sovereign_state' AND iso3 IS NOT NULL ORDER BY iso3
  ` as unknown as JurisdictionRow[];
  const sourceIds = CI_RESEARCH_PANEL_INDICATORS.map((row) => row.sourceId);
  const indicatorIds = CI_RESEARCH_PANEL_INDICATORS.map((row) => row.indicatorId);
  const history = await sql`
    SELECT jurisdiction_id::text AS "jurisdictionId", source_id AS "sourceId",
      indicator AS "indicatorId", year AS "periodYear", value,
      upstream_release AS "upstreamRelease", artifact_hash AS "artifactHash"
    FROM indicator_history
    WHERE year BETWEEN ${CI_RESEARCH_PANEL_START_YEAR} AND ${CI_RESEARCH_PANEL_END_YEAR}
      AND source_id = ANY(${sourceIds}) AND indicator = ANY(${indicatorIds})
      AND value_status = 'observed' AND value IS NOT NULL
    ORDER BY source_id, indicator, jurisdiction_id, year
  ` as unknown as HistoryRow[];
  const observed = new Map(history.map((row) => [
    `${row.sourceId}:${row.indicatorId}:${row.jurisdictionId}:${row.periodYear}`,
    row,
  ]));
  if (observed.size !== history.length) throw new Error("duplicate source history identity");

  const rows: Array<Record<string, unknown>> = [];
  const sourceSnapshot: Record<string, unknown>[] = [];
  for (const contract of CI_RESEARCH_PANEL_INDICATORS) {
    const matching = history.filter((row) => row.sourceId === contract.sourceId && row.indicatorId === contract.indicatorId);
    const releases = [...new Set(matching.map((row) => row.upstreamRelease))].sort();
    const artifactHashes = [...new Set(matching.map((row) => row.artifactHash))].sort();
    if (releases.length !== 1 || artifactHashes.length !== 1) {
      throw new Error(`${contract.sourceId}/${contract.indicatorId} has ambiguous vintage or artifact lineage`);
    }
    sourceSnapshot.push({
      sourceId: contract.sourceId, sourceOwner: contract.sourceOwner,
      indicatorId: contract.indicatorId, sourceVintage: releases[0],
      sourceVintageStatus: "legacy_retained_label_not_publisher_version",
      artifactHash: artifactHashes[0], retrievalPath: contract.retrievalPath,
      officialReference: contract.officialReference,
    });
    for (const jurisdiction of jurisdictions) {
      for (let year = CI_RESEARCH_PANEL_START_YEAR; year <= CI_RESEARCH_PANEL_END_YEAR; year++) {
        const source = observed.get(`${contract.sourceId}:${contract.indicatorId}:${jurisdiction.id}:${year}`);
        const core = {
          releaseId: CI_RESEARCH_PANEL_RELEASE_ID,
          jurisdictionId: jurisdiction.id,
          periodYear: year,
          dimension: contract.dimension,
          indicatorId: contract.indicatorId,
          sourceId: contract.sourceId,
          sourceOwner: contract.sourceOwner,
          retrievalPath: contract.retrievalPath,
          value: source ? Number(source.value) : null,
          valueStatus: source ? "observed" : "missing",
          missingReason: source ? null : panelMissingReason(contract, year),
          nativeUnit: contract.nativeUnit,
          nativeMin: contract.nativeMin,
          nativeMax: contract.nativeMax,
          isInverted: contract.isInverted,
          transformId: "identity_native_scale/v1",
          sourceVintage: releases[0],
          sourceVintageStatus: "legacy_retained_label_not_publisher_version",
          artifactHash: artifactHashes[0],
          uncertaintyStatus: contract.uncertaintyStatus,
          uncertaintyLower: null,
          uncertaintyUpper: null,
          revisionStatus: contract.revisionStatus,
          seriesType: "current_harmonized_backcast_not_as_published",
        };
        rows.push({ ...core, contentHash: researchPanelHash(core) });
      }
    }
  }
  rows.sort((a, b) =>
    `${a.sourceId}:${a.indicatorId}:${a.periodYear}:${a.jurisdictionId}`.localeCompare(
      `${b.sourceId}:${b.indicatorId}:${b.periodYear}:${b.jurisdictionId}`,
    ),
  );

  const observedRows = rows.filter((row) => row.valueStatus === "observed").length;
  const missingRows = rows.length - observedRows;
  const coverage = CI_RESEARCH_PANEL_INDICATORS.map((contract) => {
    const sourceRows = rows.filter((row) => row.sourceId === contract.sourceId && row.indicatorId === contract.indicatorId);
    const byYear = [];
    for (let year = CI_RESEARCH_PANEL_START_YEAR; year <= CI_RESEARCH_PANEL_END_YEAR; year++) {
      const yearRows = sourceRows.filter((row) => row.periodYear === year);
      const missingReasons = Object.fromEntries(
        [...new Set(yearRows.map((row) => row.missingReason).filter(Boolean) as string[])].sort().map((reason) => [
          reason, yearRows.filter((row) => row.missingReason === reason).length,
        ]),
      );
      byYear.push({ year, observed: yearRows.filter((row) => row.valueStatus === "observed").length, missing: yearRows.filter((row) => row.valueStatus === "missing").length, missingReasons });
    }
    return { sourceId: contract.sourceId, indicatorId: contract.indicatorId, dimension: contract.dimension, observed: sourceRows.filter((row) => row.valueStatus === "observed").length, missing: sourceRows.filter((row) => row.valueStatus === "missing").length, byYear };
  });
  const rowSha256 = researchPanelHash(rows);
  const coverageSha256 = researchPanelHash(coverage);
  const temporalBreaksSha256 = researchPanelHash(CI_RESEARCH_PANEL_TEMPORAL_BREAKS);
  const manifest = {
    schemaVersion: CI_RESEARCH_PANEL_SCHEMA_VERSION,
    releaseId: CI_RESEARCH_PANEL_RELEASE_ID,
    period: { start: CI_RESEARCH_PANEL_START_YEAR, end: CI_RESEARCH_PANEL_END_YEAR },
    scope: { jurisdictionStatus: "sovereign_state", jurisdictions: jurisdictions.length, indicators: CI_RESEARCH_PANEL_INDICATORS.length, expectedRows: rows.length, observedRows, missingRows },
    rowSha256, coverageSha256, temporalBreaksSha256,
    generatorVersion: CI_RESEARCH_PANEL_GENERATOR_VERSION,
    sourceSnapshot,
    seriesType: "current_harmonized_backcast_not_as_published",
    valuesLocation: "private_neon_ci_research_panel_rows",
    rightsPosture: CI_RESEARCH_PANEL_RIGHTS_POSTURE,
    publicBulkValuesIncluded: false,
  };

  if (write) {
    const existing = await sql`SELECT status,row_sha256 FROM ci_research_panel_releases WHERE id=${CI_RESEARCH_PANEL_RELEASE_ID}`;
    if (existing[0]?.status === "complete") {
      if (existing[0].row_sha256 !== rowSha256) throw new Error("completed panel exists with a different hash");
    } else {
      if (existing[0] && existing[0].row_sha256 !== rowSha256) {
        throw new Error("staging panel exists with a different hash; publish a new release id");
      }
      if (!existing[0]) await sql`INSERT INTO ci_research_panel_releases (
        id,schema_version,status,period_start,period_end,jurisdiction_count,indicator_count,
        expected_rows,observed_rows,missing_rows,row_sha256,coverage_sha256,temporal_breaks_sha256,
        generator_version,source_snapshot,rights_posture
      ) VALUES (
        ${CI_RESEARCH_PANEL_RELEASE_ID},${CI_RESEARCH_PANEL_SCHEMA_VERSION},'staging',
        ${CI_RESEARCH_PANEL_START_YEAR},${CI_RESEARCH_PANEL_END_YEAR},${jurisdictions.length},
        ${CI_RESEARCH_PANEL_INDICATORS.length},${rows.length},${observedRows},${missingRows},
        ${rowSha256},${coverageSha256},${temporalBreaksSha256},${CI_RESEARCH_PANEL_GENERATOR_VERSION},
        ${JSON.stringify(sourceSnapshot)}::jsonb,${CI_RESEARCH_PANEL_RIGHTS_POSTURE}
      )`;
      for (let start = 0; start < rows.length; start += 500) {
        const batch = rows.slice(start, start + 500);
        await sql`INSERT INTO ci_research_panel_rows (
          release_id,jurisdiction_id,period_year,dimension,indicator_id,source_id,source_owner,
          retrieval_path,value,value_status,missing_reason,native_unit,native_min,native_max,is_inverted,
          transform_id,source_vintage,source_vintage_status,artifact_hash,uncertainty_status,
          uncertainty_lower,uncertainty_upper,revision_status,series_type,content_hash
        ) SELECT x."releaseId",x."jurisdictionId",x."periodYear",x.dimension,x."indicatorId",x."sourceId",
          x."sourceOwner",x."retrievalPath",x.value,x."valueStatus",x."missingReason",x."nativeUnit",
          x."nativeMin",x."nativeMax",x."isInverted",x."transformId",x."sourceVintage",
          x."sourceVintageStatus",x."artifactHash",x."uncertaintyStatus",x."uncertaintyLower",
          x."uncertaintyUpper",x."revisionStatus",x."seriesType",x."contentHash"
        FROM jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) AS x(
          "releaseId" text,"jurisdictionId" uuid,"periodYear" integer,dimension text,"indicatorId" text,
          "sourceId" text,"sourceOwner" text,"retrievalPath" text,value real,"valueStatus" text,
          "missingReason" text,"nativeUnit" text,"nativeMin" real,"nativeMax" real,"isInverted" boolean,
          "transformId" text,"sourceVintage" text,"sourceVintageStatus" text,"artifactHash" text,
          "uncertaintyStatus" text,"uncertaintyLower" real,"uncertaintyUpper" real,"revisionStatus" text,
          "seriesType" text,"contentHash" text
        ) ON CONFLICT DO NOTHING`;
      }
      const [stored] = await sql`SELECT count(*)::int total,count(*) FILTER(WHERE value_status='observed')::int observed FROM ci_research_panel_rows WHERE release_id=${CI_RESEARCH_PANEL_RELEASE_ID}`;
      if (Number(stored.total) !== rows.length || Number(stored.observed) !== observedRows) throw new Error("stored panel counts differ before publication");
      const storedIdentities = await sql`SELECT source_id AS "sourceId",indicator_id AS "indicatorId",period_year AS "periodYear",jurisdiction_id::text AS "jurisdictionId",content_hash AS "contentHash" FROM ci_research_panel_rows WHERE release_id=${CI_RESEARCH_PANEL_RELEASE_ID} ORDER BY source_id,indicator_id,period_year,jurisdiction_id`;
      const expectedIdentities = rows.map((row) => ({ sourceId: row.sourceId, indicatorId: row.indicatorId, periodYear: row.periodYear, jurisdictionId: row.jurisdictionId, contentHash: row.contentHash }));
      if (researchPanelHash(storedIdentities) !== researchPanelHash(expectedIdentities)) throw new Error("stored staging identities or content hashes differ");
      await sql`UPDATE ci_research_panel_releases SET status='complete',completed_at=NOW() WHERE id=${CI_RESEARCH_PANEL_RELEASE_ID} AND status='staging'`;
    }
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(`${outputDir}/manifest.v1.json`, `${JSON.stringify(manifest, null, 2)}\n`);
    writeFileSync(`${outputDir}/coverage.v1.json`, `${JSON.stringify({ schemaVersion: "ci-research-panel-coverage/v1", releaseId: CI_RESEARCH_PANEL_RELEASE_ID, coverage }, null, 2)}\n`);
    writeFileSync(`${outputDir}/temporal-breaks.v1.json`, `${JSON.stringify({ schemaVersion: "ci-research-panel-temporal-breaks/v1", releaseId: CI_RESEARCH_PANEL_RELEASE_ID, breaks: CI_RESEARCH_PANEL_TEMPORAL_BREAKS }, null, 2)}\n`);
  }
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
