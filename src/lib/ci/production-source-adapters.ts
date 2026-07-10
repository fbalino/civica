/**
 * Canonical parsers for the source files that produce the current four
 * Civica Index Beta dimensions. The parsers are pure: callers supply bytes
 * (and, for Freedom House, a jurisdiction-name map) and receive native-scale
 * records. Network retrieval and database writes stay in the thin scripts.
 *
 * DAT-001 deliberately keeps the deployed WGI Voice & Accountability
 * substitution explicit. It fills democratic-quality rows absent from V-Dem;
 * it is not treated as V-Dem or hidden behind the dimension label.
 */

import type { CIDimension, IngestionResult, SourceDataRecord } from "./types";
import releaseCoverage from "./production-release-coverage.generated.json";
import {
  csvObjects,
  minMax,
  normalizeCountryName,
  normalizeIso3Code,
  rowsToObjects,
  toNumber,
  xlsxSheetRows,
  zipEntryText,
} from "./source-utils";

export const CI_RELEASE_DATASET_YEAR = 2024 as const;
export type CIReleaseGroupId = keyof typeof releaseCoverage.groups;

export const CI_PRODUCTION_SOURCE_URLS = {
  vdem: "https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip",
  worldbankWgi:
    "https://www.worldbank.org/content/dam/sites/govindicators/doc/wgidataset_with_sourcedata-2025.xlsx",
  freedomHouse:
    "https://freedomhouse.org/sites/default/files/2024-02/Aggregate_Category_and_Subcategory_Scores_FIW_2003-2024.xlsx",
  transparencyCpi:
    "https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx",
} as const;

function ingestionResult(
  sourceId: string,
  dimension: CIDimension,
  datasetYear: number,
  records: SourceDataRecord[],
): IngestionResult {
  const { min, max } = minMax(records.map((record) => record.rawValue));
  return {
    sourceId,
    dimension,
    datasetYear,
    records,
    globalMinObserved: min,
    globalMaxObserved: max,
  };
}

export function parseVdemCore(
  buffer: Buffer,
  datasetYear: number = CI_RELEASE_DATASET_YEAR,
): IngestionResult {
  const csv = zipEntryText(
    buffer,
    (name) => name.endsWith(".csv") && name.includes("V-Dem-CY-Core"),
  );
  const rows = csvObjects(
    csv,
    (row) =>
      row.includes("country_text_id") &&
      row.includes("year") &&
      row.includes("v2x_libdem"),
  );
  const records: SourceDataRecord[] = rows.flatMap((row) => {
    if (Number(row.year) !== datasetYear) return [];
    const iso3 = normalizeIso3Code(row.country_text_id ?? "");
    const rawValue = toNumber(row.v2x_libdem);
    if (!/^[A-Z]{3}$/.test(iso3) || rawValue === null) return [];
    return [
      {
        iso3,
        year: datasetYear,
        dimension: "democratic_quality",
        indicator: "v2x_libdem",
        rawValue,
        nativeMin: 0,
        nativeMax: 1,
        isInverted: false,
      },
    ];
  });
  return ingestionResult("vdem", "democratic_quality", datasetYear, records);
}

function parseWgiSheet(
  buffer: Buffer,
  sheetName: "rl" | "va",
  dimension: "rule_of_law" | "democratic_quality",
  indicator: "rl.est" | "va.est",
  datasetYear: number,
): IngestionResult {
  const valueColumn = "Governance estimate (approx. -2.5 to +2.5)";
  const rows = rowsToObjects(
    xlsxSheetRows(buffer, sheetName),
    (row) =>
      row.includes("Economy (code)") &&
      row.includes("Year") &&
      row.includes(valueColumn),
  );
  const records: SourceDataRecord[] = rows.flatMap((row) => {
    if (Number(row.Year) !== datasetYear) return [];
    const iso3 = normalizeIso3Code(row["Economy (code)"] ?? "");
    const rawValue = toNumber(row[valueColumn]);
    if (!/^[A-Z]{3}$/.test(iso3) || rawValue === null) return [];
    return [
      {
        iso3,
        year: datasetYear,
        dimension,
        indicator,
        rawValue,
        nativeMin: -2.5,
        nativeMax: 2.5,
        isInverted: false,
      },
    ];
  });
  return ingestionResult("worldbank_wgi", dimension, datasetYear, records);
}

export function parseWgiRuleOfLaw(
  buffer: Buffer,
  datasetYear: number = CI_RELEASE_DATASET_YEAR,
): IngestionResult {
  return parseWgiSheet(buffer, "rl", "rule_of_law", "rl.est", datasetYear);
}

export function parseWgiVoiceAccountability(
  buffer: Buffer,
  datasetYear: number = CI_RELEASE_DATASET_YEAR,
): IngestionResult {
  return parseWgiSheet(
    buffer,
    "va",
    "democratic_quality",
    "va.est",
    datasetYear,
  );
}

export interface FreedomHouseParseResult {
  ingestion: IngestionResult;
  unmatchedCountryNames: readonly string[];
}

export function parseFreedomHouse(
  buffer: Buffer,
  iso3ByCountryName: ReadonlyMap<string, string>,
  datasetYear: number = CI_RELEASE_DATASET_YEAR,
): FreedomHouseParseResult {
  const rows = rowsToObjects(
    xlsxSheetRows(buffer, "FIW06-24"),
    (row) => row.includes("Country/Territory") && row.includes("Edition"),
  );
  const unmatched = new Set<string>();
  const records: SourceDataRecord[] = rows.flatMap((row) => {
    if (Number(row.Edition) !== datasetYear) return [];
    if ((row["C/T?"] ?? "").toLowerCase() !== "c") return [];
    const countryName = row["Country/Territory"]?.trim();
    const pr = toNumber(row["PR Rating"]);
    const cl = toNumber(row["CL Rating"]);
    if (!countryName || pr === null || cl === null) return [];
    const iso3 = iso3ByCountryName.get(normalizeCountryName(countryName));
    if (!iso3) {
      unmatched.add(countryName);
      return [];
    }
    return [
      {
        iso3,
        year: datasetYear,
        dimension: "freedom_rights",
        indicator: "pr_cl_total",
        rawValue: pr + cl,
        nativeMin: 2,
        nativeMax: 14,
        isInverted: true,
      },
    ];
  });
  return {
    ingestion: ingestionResult(
      "freedom_house",
      "freedom_rights",
      datasetYear,
      records,
    ),
    unmatchedCountryNames: [...unmatched].sort(),
  };
}

export function parseTransparencyCpi(
  buffer: Buffer,
  datasetYear: number = CI_RELEASE_DATASET_YEAR,
): IngestionResult {
  const scoreColumn = `CPI ${datasetYear} score`;
  const rows = rowsToObjects(
    xlsxSheetRows(buffer, `CPI ${datasetYear}`),
    (row) => row.includes("ISO3") && row.includes(scoreColumn),
  );
  const records: SourceDataRecord[] = rows.flatMap((row) => {
    const iso3 = normalizeIso3Code(row.ISO3 ?? "");
    const rawValue = toNumber(row[scoreColumn]);
    if (!/^[A-Z]{3}$/.test(iso3) || rawValue === null) return [];
    return [
      {
        iso3,
        year: datasetYear,
        dimension: "corruption_control",
        indicator: "score",
        rawValue,
        nativeMin: 0,
        nativeMax: 100,
        isInverted: false,
      },
    ];
  });
  return ingestionResult(
    "transparency_intl",
    "corruption_control",
    datasetYear,
    records,
  );
}

export function wgiFallbackRecords(
  wgiVoice: IngestionResult,
  vdemIso3: ReadonlySet<string>,
): IngestionResult {
  const records = wgiVoice.records.filter(
    (record) => !vdemIso3.has(record.iso3.toUpperCase()),
  );
  if (records.length === 0) {
    return {
      ...wgiVoice,
      records,
      globalMinObserved: 0,
      globalMaxObserved: 0,
    };
  }
  return ingestionResult(
    "worldbank_wgi",
    "democratic_quality",
    wgiVoice.datasetYear,
    records,
  );
}

/**
 * Preserve the exact jurisdiction universe of the named Beta release. Several
 * jurisdictions were added to Civica after the original ingestion; parsing
 * the same bytes against today's table must not silently expand 2024-Q4.
 * Future editions remain untouched until they receive their own manifest.
 */
export function applyFrozenReleaseCoverage(
  result: IngestionResult,
  groupId: CIReleaseGroupId,
): IngestionResult {
  if (result.datasetYear !== releaseCoverage.datasetYear) return result;
  const exclusions = new Set<string>(
    releaseCoverage.groups[groupId].excludedEligibleIso3,
  );
  const records = result.records.filter(
    (record) => !exclusions.has(record.iso3),
  );
  if (records.length === result.records.length) return result;
  return ingestionResult(
    result.sourceId,
    result.dimension,
    result.datasetYear,
    records,
  );
}
