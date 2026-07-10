/**
 * DAT-001 read-only clean-room audit for the current Civica Index inputs.
 * Downloads the four declared 2024 publisher artifacts, parses them through
 * the production code, and compares the jurisdiction-matched semantic rows to
 * the live Beta table. It never writes to the database or source freshness.
 */

import { createHash } from "node:crypto";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

import {
  CI_PRODUCTION_SOURCE_URLS,
  CI_RELEASE_DATASET_YEAR,
  applyFrozenReleaseCoverage,
  parseFreedomHouse,
  parseTransparencyCpi,
  parseVdemCore,
  parseWgiRuleOfLaw,
  parseWgiVoiceAccountability,
  wgiFallbackRecords,
} from "../src/lib/ci/production-source-adapters";
import type { IngestionResult, SourceDataRecord } from "../src/lib/ci/types";
import {
  buildIso3ByCountryName,
  fetchBuffer,
} from "../src/lib/ci/source-utils";
import { buildIso3Map, createDb } from "../src/lib/ci/ingest";
import releaseCoverage from "../src/lib/ci/production-release-coverage.generated.json";

config({ path: ".env.local" });

interface LiveRow {
  iso3: string;
  dimension: string;
  source_id: string;
  raw_value: number;
}

interface AuditRow {
  id: string;
  sourceId: string;
  dimension: string;
  parsedRows: number;
  matchedRows: number;
  releaseRows: number;
  liveRows: number;
  expectedHash: string;
  liveHash: string;
  parsedOnlyIso3: readonly string[];
  liveOnlyIso3: readonly string[];
  valueMismatches: readonly {
    iso3: string;
    parsed: number;
    live: number;
  }[];
  pass: boolean;
}

function semanticHash(
  rows: readonly Pick<SourceDataRecord, "iso3" | "rawValue">[],
): string {
  const canonical = rows
    // Postgres `real` is float32 while publisher parsers use JS float64. The
    // tiny sign-aware epsilon makes half-way decimal rounding deterministic
    // across those representations; the separate comparison below still
    // enforces an absolute 1e-6 tolerance before hashing.
    .map((row) => {
      const value = Number(row.rawValue);
      const rounded = Math.round((value + Math.sign(value) * 1e-9) * 1e6) / 1e6;
      return `${row.iso3.toUpperCase()}|${rounded.toFixed(6)}`;
    })
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

function inputHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for the read-only live-row comparison.",
    );
  }
  const datasetYear = CI_RELEASE_DATASET_YEAR;
  const quarter = `${datasetYear}-Q4`;
  const retrievalStartedAt = new Date().toISOString();
  const db = createDb();
  const [
    iso3Map,
    iso3ByCountryName,
    vdemBytes,
    wgiBytes,
    freedomBytes,
    cpiBytes,
  ] = await Promise.all([
    buildIso3Map(db),
    buildIso3ByCountryName(db),
    fetchBuffer(
      process.env.VDEM_CY_CORE_ZIP_URL ?? CI_PRODUCTION_SOURCE_URLS.vdem,
    ),
    fetchBuffer(
      process.env.WGI_DATASET_XLSX_URL ??
        CI_PRODUCTION_SOURCE_URLS.worldbankWgi,
    ),
    fetchBuffer(
      process.env.FREEDOM_HOUSE_FIW_XLSX_URL ??
        CI_PRODUCTION_SOURCE_URLS.freedomHouse,
    ),
    fetchBuffer(
      process.env.TRANSPARENCY_CPI_XLSX_URL ??
        CI_PRODUCTION_SOURCE_URLS.transparencyCpi,
    ),
  ]);
  const retrievalFinishedAt = new Date().toISOString();

  const vdem = applyFrozenReleaseCoverage(
    parseVdemCore(vdemBytes, datasetYear),
    "vdem.democratic_quality",
  );
  const wgiRule = applyFrozenReleaseCoverage(
    parseWgiRuleOfLaw(wgiBytes, datasetYear),
    "worldbank_wgi.rule_of_law",
  );
  const wgiVoice = parseWgiVoiceAccountability(wgiBytes, datasetYear);
  const freedomParsed = parseFreedomHouse(
    freedomBytes,
    iso3ByCountryName,
    datasetYear,
  );
  const freedom = {
    ...freedomParsed,
    ingestion: applyFrozenReleaseCoverage(
      freedomParsed.ingestion,
      "freedom_house.freedom_rights",
    ),
  };
  const cpi = applyFrozenReleaseCoverage(
    parseTransparencyCpi(cpiBytes, datasetYear),
    "transparency_intl.corruption_control",
  );
  const fallback = applyFrozenReleaseCoverage(
    wgiFallbackRecords(
      wgiVoice,
      new Set(vdem.records.map((row) => row.iso3.toUpperCase())),
    ),
    "worldbank_wgi.democratic_quality_fallback",
  );

  const inputs = {
    vdem: inputHash(vdemBytes),
    worldbankWgi: inputHash(wgiBytes),
    freedomHouse: inputHash(freedomBytes),
    transparencyCpi: inputHash(cpiBytes),
  };
  const inputHashPass =
    inputs.vdem === releaseCoverage.inputSha256.vdem &&
    inputs.worldbankWgi === releaseCoverage.inputSha256.worldbankWgi &&
    inputs.freedomHouse === releaseCoverage.inputSha256.freedomHouse &&
    inputs.transparencyCpi === releaseCoverage.inputSha256.transparencyCpi;

  const sql = neon(process.env.DATABASE_URL);
  const liveRows = (await sql`
    SELECT j.iso3, cds.dimension, cds.source_id, cds.raw_value
    FROM ci_dimension_scores cds
    JOIN jurisdictions j ON j.id = cds.jurisdiction_id
    WHERE cds.quarter = ${quarter}
      AND cds.methodology_version = 'beta'
      AND cds.dimension IN (
        'democratic_quality',
        'rule_of_law',
        'freedom_rights',
        'corruption_control'
      )
  `) as LiveRow[];

  const definitions: readonly [string, IngestionResult][] = [
    ["vdem.democratic_quality", vdem],
    ["worldbank_wgi.democratic_quality_fallback", fallback],
    ["worldbank_wgi.rule_of_law", wgiRule],
    ["freedom_house.freedom_rights", freedom.ingestion],
    ["transparency_intl.corruption_control", cpi],
  ];

  const rows: AuditRow[] = definitions.map(([id, result]) => {
    const matched = result.records.filter((record) => iso3Map.has(record.iso3));
    const releaseGroup =
      releaseCoverage.groups[id as keyof typeof releaseCoverage.groups];
    if (!releaseGroup) throw new Error(`Release manifest is missing ${id}.`);
    const exclusions = new Set(releaseGroup.excludedEligibleIso3);
    const releaseRows = matched.filter(
      (record) => !exclusions.has(record.iso3),
    );
    const live = liveRows
      .filter(
        (row) =>
          row.source_id === result.sourceId &&
          row.dimension === result.dimension,
      )
      .map((row) => ({ iso3: row.iso3, rawValue: Number(row.raw_value) }));
    const matchedByIso3 = new Map(
      releaseRows.map((row) => [row.iso3.toUpperCase(), row.rawValue]),
    );
    const liveByIso3 = new Map(
      live.map((row) => [row.iso3.toUpperCase(), row.rawValue]),
    );
    const parsedOnlyIso3 = [...matchedByIso3.keys()]
      .filter((iso3) => !liveByIso3.has(iso3))
      .sort();
    const liveOnlyIso3 = [...liveByIso3.keys()]
      .filter((iso3) => !matchedByIso3.has(iso3))
      .sort();
    const valueMismatches = [...matchedByIso3]
      .flatMap(([iso3, parsed]) => {
        const liveValue = liveByIso3.get(iso3);
        if (
          liveValue === undefined ||
          Math.abs(Number(parsed) - Number(liveValue)) <= 1e-6
        ) {
          return [];
        }
        return [{ iso3, parsed, live: liveValue }];
      })
      .sort((a, b) => a.iso3.localeCompare(b.iso3));
    const expectedHash = semanticHash(releaseRows);
    const liveHash = semanticHash(live);
    return {
      id,
      sourceId: result.sourceId,
      dimension: result.dimension,
      parsedRows: result.records.length,
      matchedRows: matched.length,
      releaseRows: releaseRows.length,
      liveRows: live.length,
      expectedHash,
      liveHash,
      parsedOnlyIso3,
      liveOnlyIso3,
      valueMismatches,
      pass:
        releaseRows.length === releaseGroup.expectedRows &&
        expectedHash === releaseGroup.semanticSha256 &&
        parsedOnlyIso3.length === 0 &&
        liveOnlyIso3.length === 0 &&
        valueMismatches.length === 0 &&
        expectedHash === liveHash,
    };
  });

  const report = {
    schemaVersion: 1,
    readOnly: true,
    datasetYear,
    quarter,
    retrievalStartedAt,
    retrievalFinishedAt,
    tolerance: {
      rowCount: "exact",
      rawValue:
        "absolute difference <= 1e-6; deterministic six-decimal SHA-256 checksum representation",
    },
    inputSha256: inputs,
    inputHashPass,
    freedomHouseUnmatchedCountryNames: freedom.unmatchedCountryNames,
    rows,
    pass: inputHashPass && rows.every((row) => row.pass),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
