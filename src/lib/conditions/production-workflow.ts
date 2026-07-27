import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { and, eq, isNotNull } from "drizzle-orm";

import type { CivicaDb } from "@/lib/db";
import { ciDimensionScores, jurisdictions } from "@/lib/db/schema";
import { stableStringify } from "@/lib/data/frozen-vintage";
import { buildIndicatorLineage } from "@/lib/indicators/lineage";
import {
  CONDITIONS_ALIGNMENT_POLICY,
  CONDITIONS_DIMENSIONS,
  CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  conditionCalculationKey,
  type ConditionScoreInput,
  type ConditionsDimension,
} from "./contract";
import {
  buildEconomicConditionsCalculations,
  buildEconomicReferenceSets,
  type EconomicComponentObservation,
  type EconomicLineages,
  type EconomicObservation,
} from "./economic";
import { writeConditionsRelease } from "./ingest";
import {
  buildFixedBoundReferenceSets,
  conditionsReleaseManifestSha256,
  type ConditionsReferenceSet,
  type ConditionsReleaseInput,
} from "./release";
import type { ConditionsReleaseValidationExpectations } from "./release-live-validation";

const HDI_SOURCE_ID = "undp_hdi";
const HDI_SOURCE_DIMENSION = "human_development";
const HDI_SOURCE_METHODOLOGY_VERSION = "v1.0";
const GPI_SOURCE_ID = "global_peace_index";
const GPI_SOURCE_DIMENSION = "stability_security";
const GPI_SOURCE_METHODOLOGY_VERSION = "v1.0";

const WORLD_BANK_SOURCE_ID = "worldbank_economic";
const WORLD_BANK_BASE_URL = "https://api.worldbank.org/v2";
export const WORLD_BANK_ECONOMIC_DATE_RANGE = "2020:2024";
const WORLD_BANK_PER_PAGE = 10;
// Verified against the World Bank API on 2026-07-26: XKS returns the
// unsupported-country envelope while the publisher's XKX code resolves Kosovo.
const WORLD_BANK_COUNTRY_CODE_OVERRIDES: Readonly<Record<string, string>> = {
  XKS: "XKX",
};
// The World Bank endpoint begins returning malformed transient responses under
// higher fan-out. Keep capture deliberately gentle and fail closed on any
// response that still violates the contract.
const WORLD_BANK_CAPTURE_CONCURRENCY = 2;
/**
 * Catastrophic-partial-coverage guard for a global World Bank release.
 *
 * The existing Index ingestion contract requires broad World Bank coverage
 * (180 jurisdictions for its WGI series). Conditions uses a ratio because its
 * public sovereign-state eligibility set can change as jurisdiction records
 * are corrected. Three quarters is deliberately stricter than a simple
 * majority while the captured and released ledger still retains documented
 * publisher noncoverage for every ISO-coded jurisdiction as explicit missing
 * rows.
 */
export const WORLD_BANK_ECONOMIC_MINIMUM_COVERAGE_RATIO = 0.75;
export const CONDITIONS_COVERAGE_ADMISSION_JURISDICTION_STATUS =
  "sovereign_state" as const;
export const WORLD_BANK_ECONOMIC_INDICATORS = {
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
  gdpGrowth: "NY.GDP.MKTP.KD.ZG",
} as const;
export const WORLD_BANK_ECONOMIC_CAPTURE_SCHEMA_VERSION =
  "conditions-world-bank-economic-capture/v2" as const;

type ConditionsDb = CivicaDb;
type CiDimensionScore = typeof ciDimensionScores.$inferSelect;

export interface PreparedConditionsDimension {
  rows: ConditionScoreInput[];
  referenceSets: ConditionsReferenceSet[];
  expectedCalculationCount: number;
}

export type ConditionsExpectedCalculationCounts = Readonly<
  Record<ConditionsDimension, number>
>;

export interface WorldBankEconomicCaptureResponse {
  jurisdictionId: string;
  iso2: string;
  requestCountryCode: string;
  indicatorId: string;
  requestUrl: string;
  httpStatus: number;
  retrievedAt: string;
  responseBodySha256: string;
  responseBody: string;
}

export interface WorldBankEconomicCapture {
  schemaVersion: typeof WORLD_BANK_ECONOMIC_CAPTURE_SCHEMA_VERSION;
  baseUrl: typeof WORLD_BANK_BASE_URL;
  dateRange: typeof WORLD_BANK_ECONOMIC_DATE_RANGE;
  perPage: typeof WORLD_BANK_PER_PAGE;
  responses: WorldBankEconomicCaptureResponse[];
  captureSha256: string;
}

export interface ConditionsCoverageAdmissionJurisdiction {
  id: string;
  iso2: string;
  requestCountryCode: string;
  jurisdictionStatus: string;
}

interface CaptureCore {
  schemaVersion: typeof WORLD_BANK_ECONOMIC_CAPTURE_SCHEMA_VERSION;
  baseUrl: typeof WORLD_BANK_BASE_URL;
  dateRange: typeof WORLD_BANK_ECONOMIC_DATE_RANGE;
  perPage: typeof WORLD_BANK_PER_PAGE;
  responses: WorldBankEconomicCaptureResponse[];
}

export interface ConditionsWorkflowDependencies {
  prepareHdi: (
    db: ConditionsDb,
    releaseId: string,
  ) => Promise<PreparedConditionsDimension>;
  prepareGpi: (
    db: ConditionsDb,
    releaseId: string,
  ) => Promise<PreparedConditionsDimension>;
  prepareEconomic: (
    db: ConditionsDb,
    releaseId: string,
    options: EconomicInputOptions,
  ) => Promise<PreparedConditionsDimension>;
  writeRelease: typeof writeConditionsRelease;
}

export interface EconomicInputOptions {
  inputFile?: string;
  captureOutput?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface RunConditionsWorkflowOptions extends EconomicInputOptions {
  releaseId: string;
  dryRun?: boolean;
  releaseExpectations?: ConditionsReleaseValidationExpectations;
  dependencies?: Partial<ConditionsWorkflowDependencies>;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareOptionalText(
  left: string | null,
  right: string | null,
): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compareText(right, left);
}

function referenceYear(quarter: string): number | null {
  const match = /^(\d{4})-Q[1-4]$/.exec(quarter);
  return match ? Number(match[1]) : null;
}

function periodOrdinal(quarter: string): number | null {
  const match = /^(\d{4})-Q([1-4])$/.exec(quarter);
  return match ? Number(match[1]) * 4 + Number(match[2]) : null;
}

function selectLatestSourceRows(
  sourceRows: readonly CiDimensionScore[],
): CiDimensionScore[] {
  const ordered = [...sourceRows].sort((left, right) => {
    const jurisdictionComparison = compareText(
      left.jurisdictionId,
      right.jurisdictionId,
    );
    if (jurisdictionComparison !== 0) return jurisdictionComparison;

    const leftPeriod = periodOrdinal(left.quarter);
    const rightPeriod = periodOrdinal(right.quarter);
    if (leftPeriod !== rightPeriod) {
      if (leftPeriod === null) return 1;
      if (rightPeriod === null) return -1;
      return rightPeriod - leftPeriod;
    }

    const leftCreatedAt = left.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const rightCreatedAt =
      right.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (leftCreatedAt !== rightCreatedAt) return rightCreatedAt - leftCreatedAt;

    const releaseComparison = compareOptionalText(
      left.releaseId,
      right.releaseId,
    );
    if (releaseComparison !== 0) return releaseComparison;

    const indicatorComparison = compareText(
      left.indicatorId,
      right.indicatorId,
    );
    if (indicatorComparison !== 0) return indicatorComparison;

    return compareText(left.id, right.id);
  });

  const selected = new Map<string, CiDimensionScore>();
  for (const row of ordered) {
    if (!selected.has(row.jurisdictionId)) {
      selected.set(row.jurisdictionId, row);
    }
  }
  return [...selected.values()];
}

function assertExpectedCalculationCount(
  dimension: ConditionsDimension,
  rows: readonly ConditionScoreInput[],
  expectedCalculationCount: number,
): void {
  if (
    !Number.isSafeInteger(expectedCalculationCount) ||
    expectedCalculationCount <= 0
  ) {
    throw new Error(
      `Conditions ${dimension} expected calculation count must be a positive integer`,
    );
  }
  if (rows.length !== expectedCalculationCount) {
    throw new Error(
      `Conditions ${dimension} produced ${rows.length} calculations; expected ${expectedCalculationCount}`,
    );
  }
}

function hdiRow(row: CiDimensionScore, releaseId: string): ConditionScoreInput {
  const year = referenceYear(row.quarter);
  const observed = row.rawValue !== null && year !== null;
  const reason = row.rawValue === null
    ? "The copied HDI source row has no native raw value"
    : "The copied HDI source row has an invalid reference quarter";
  const component = {
    componentId: "hdi" as const,
    nativeValue: observed ? row.rawValue : null,
    nativeUnit: "index_0_1",
    referenceYear: observed ? year : null,
    valueStatus: observed ? ("observed" as const) : ("missing" as const),
    valueStatusReason: observed ? null : reason,
    inclusionDecision: observed ? ("included" as const) : ("excluded_missing" as const),
    sourceId: HDI_SOURCE_ID,
    indicatorId: row.indicatorId,
    upstreamRelease: row.upstreamRelease,
    artifactHash: row.artifactHash,
    artifactKind: row.artifactKind as "publisher_bytes" | "normalized_batch",
    temporalCoverage: row.temporalCoverage,
    licenseUrl: row.licenseUrl,
    transformationId: "conditions-hdi-component/v2",
    substitutionReason: row.substitutionReason,
    methodVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  };
  const base = {
    releaseId,
    jurisdictionId: row.jurisdictionId,
    dimension: "human_development" as const,
    quarter: observed ? row.quarter : null,
    normalizedScore: observed
      ? Math.min(100, Math.max(0, row.rawValue! * 100))
      : null,
    rawValue: observed ? row.rawValue : null,
    sourceId: HDI_SOURCE_ID,
    datasetYear: observed ? year : null,
    methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
    referenceYear: observed ? year : null,
    alignmentPolicy: CONDITIONS_ALIGNMENT_POLICY,
    alignmentStatus: observed ? ("aligned" as const) : ("missing_component" as const),
    components: [component],
    indicatorId: row.indicatorId,
    upstreamRelease: row.upstreamRelease,
    artifactHash: row.artifactHash,
    artifactKind: row.artifactKind as "publisher_bytes" | "normalized_batch",
    temporalCoverage: row.temporalCoverage,
    licenseUrl: row.licenseUrl,
    transformationId: "conditions-hdi-fixed-bound/v2",
    substitutionReason: row.substitutionReason,
    methodVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  };
  return { ...base, calculationKey: conditionCalculationKey(base) };
}

function normalizeGpi(raw: number): number {
  return Math.min(100, Math.max(0, ((5 - raw) / 4) * 100));
}

function gpiRow(row: CiDimensionScore, releaseId: string): ConditionScoreInput {
  const year = referenceYear(row.quarter);
  const observed = row.rawValue !== null && year !== null;
  const reason = row.rawValue === null
    ? "The copied GPI source row has no native raw value"
    : "The copied GPI source row has an invalid reference quarter";
  const component = {
    componentId: "global_peace_index" as const,
    nativeValue: observed ? row.rawValue : null,
    nativeUnit: "index_1_5_inverted",
    referenceYear: observed ? year : null,
    valueStatus: observed ? ("observed" as const) : ("missing" as const),
    valueStatusReason: observed ? null : reason,
    inclusionDecision: observed ? ("included" as const) : ("excluded_missing" as const),
    sourceId: GPI_SOURCE_ID,
    indicatorId: row.indicatorId,
    upstreamRelease: row.upstreamRelease,
    artifactHash: row.artifactHash,
    artifactKind: row.artifactKind as "publisher_bytes" | "normalized_batch",
    temporalCoverage: row.temporalCoverage,
    licenseUrl: row.licenseUrl,
    transformationId: "conditions-gpi-component/v2",
    substitutionReason: row.substitutionReason,
    methodVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  };
  const base = {
    releaseId,
    jurisdictionId: row.jurisdictionId,
    dimension: "peace_security" as const,
    quarter: observed ? row.quarter : null,
    normalizedScore: observed ? normalizeGpi(row.rawValue!) : null,
    rawValue: observed ? row.rawValue : null,
    sourceId: GPI_SOURCE_ID,
    datasetYear: observed ? year : null,
    methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
    referenceYear: observed ? year : null,
    alignmentPolicy: CONDITIONS_ALIGNMENT_POLICY,
    alignmentStatus: observed ? ("aligned" as const) : ("missing_component" as const),
    components: [component],
    indicatorId: row.indicatorId,
    upstreamRelease: row.upstreamRelease,
    artifactHash: row.artifactHash,
    artifactKind: row.artifactKind as "publisher_bytes" | "normalized_batch",
    temporalCoverage: row.temporalCoverage,
    licenseUrl: row.licenseUrl,
    transformationId: "conditions-gpi-fixed-bound/v2",
    substitutionReason: row.substitutionReason,
    methodVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  };
  return { ...base, calculationKey: conditionCalculationKey(base) };
}

export async function prepareHdiConditions(
  db: ConditionsDb,
  releaseId: string,
): Promise<PreparedConditionsDimension> {
  const sourceRows = await db
    .select()
    .from(ciDimensionScores)
    .where(
      and(
        eq(ciDimensionScores.dimension, HDI_SOURCE_DIMENSION),
        eq(ciDimensionScores.sourceId, HDI_SOURCE_ID),
        eq(ciDimensionScores.methodologyVersion, HDI_SOURCE_METHODOLOGY_VERSION),
      ),
    );
  if (!sourceRows.length) {
    throw new Error("No HDI rows found in ci_dimension_scores. Run ingest:ci first.");
  }
  const expectedCalculationCount = new Set(
    sourceRows.map((row) => row.jurisdictionId),
  ).size;
  const rows = selectLatestSourceRows(sourceRows).map((row) =>
    hdiRow(row, releaseId),
  );
  assertExpectedCalculationCount(
    "human_development",
    rows,
    expectedCalculationCount,
  );
  return {
    rows,
    referenceSets: buildFixedBoundReferenceSets({
      calculations: rows,
      componentId: "hdi",
      direction: "higher_is_better",
      transformationId: "conditions-hdi-fixed-bound/v2",
      lowerBound: 0,
      upperBound: 1,
    }),
    expectedCalculationCount,
  };
}

export async function prepareGpiConditions(
  db: ConditionsDb,
  releaseId: string,
): Promise<PreparedConditionsDimension> {
  const sourceRows = await db
    .select()
    .from(ciDimensionScores)
    .where(
      and(
        eq(ciDimensionScores.dimension, GPI_SOURCE_DIMENSION),
        eq(ciDimensionScores.sourceId, GPI_SOURCE_ID),
        eq(ciDimensionScores.methodologyVersion, GPI_SOURCE_METHODOLOGY_VERSION),
      ),
    );
  if (!sourceRows.length) {
    throw new Error("No GPI rows found in ci_dimension_scores. Run ingest:ci first.");
  }
  const expectedCalculationCount = new Set(
    sourceRows.map((row) => row.jurisdictionId),
  ).size;
  const rows = selectLatestSourceRows(sourceRows).map((row) =>
    gpiRow(row, releaseId),
  );
  assertExpectedCalculationCount(
    "peace_security",
    rows,
    expectedCalculationCount,
  );
  return {
    rows,
    referenceSets: buildFixedBoundReferenceSets({
      calculations: rows,
      componentId: "global_peace_index",
      direction: "lower_is_better",
      transformationId: "conditions-gpi-fixed-bound/v2",
      lowerBound: 1,
      upperBound: 5,
    }),
    expectedCalculationCount,
  };
}

function worldBankRequestUrl(
  requestCountryCode: string,
  indicatorId: string,
): string {
  return `${WORLD_BANK_BASE_URL}/country/${requestCountryCode}/indicator/${indicatorId}?format=json&date=${WORLD_BANK_ECONOMIC_DATE_RANGE}&per_page=${WORLD_BANK_PER_PAGE}`;
}

export function worldBankRequestCountryCode(input: {
  iso2: string;
  iso3: string | null;
}): string {
  const iso3 =
    typeof input.iso3 === "string" && /^[A-Za-z]{3}$/.test(input.iso3)
      ? input.iso3.toUpperCase()
      : null;
  return (
    (iso3 ? WORLD_BANK_COUNTRY_CODE_OVERRIDES[iso3] : undefined) ??
    iso3 ??
    input.iso2.toUpperCase()
  );
}

export function isConditionsCoverageAdmissionEligible(input: {
  jurisdictionStatus: string;
}): boolean {
  return (
    input.jurisdictionStatus ===
    CONDITIONS_COVERAGE_ADMISSION_JURISDICTION_STATUS
  );
}

function orderedCaptureResponses(
  responses: readonly WorldBankEconomicCaptureResponse[],
): WorldBankEconomicCaptureResponse[] {
  return [...responses].sort((left, right) =>
    compareText(
      `${left.jurisdictionId}:${left.indicatorId}`,
      `${right.jurisdictionId}:${right.indicatorId}`,
    ));
}

function captureCore(
  responses: readonly WorldBankEconomicCaptureResponse[],
): CaptureCore {
  return {
    schemaVersion: WORLD_BANK_ECONOMIC_CAPTURE_SCHEMA_VERSION,
    baseUrl: WORLD_BANK_BASE_URL,
    dateRange: WORLD_BANK_ECONOMIC_DATE_RANGE,
    perPage: WORLD_BANK_PER_PAGE,
    responses: orderedCaptureResponses(responses),
  };
}

export function buildWorldBankEconomicCapture(
  responses: readonly WorldBankEconomicCaptureResponse[],
): WorldBankEconomicCapture {
  const core = captureCore(responses);
  return {
    ...core,
    captureSha256: sha256(stableStringify(core)),
  };
}

export function validateWorldBankEconomicCapture(
  capture: WorldBankEconomicCapture,
  expectedJurisdictions?: readonly {
    id: string;
    iso2: string;
    requestCountryCode: string;
  }[],
): string[] {
  const errors: string[] = [];
  if (capture.schemaVersion !== WORLD_BANK_ECONOMIC_CAPTURE_SCHEMA_VERSION) {
    errors.push("capture schema version is invalid");
  }
  if (
    capture.baseUrl !== WORLD_BANK_BASE_URL ||
    capture.dateRange !== WORLD_BANK_ECONOMIC_DATE_RANGE ||
    capture.perPage !== WORLD_BANK_PER_PAGE
  ) {
    errors.push("capture request contract is invalid");
  }
  const expectedCaptureSha256 = sha256(
    stableStringify(captureCore(capture.responses)),
  );
  if (capture.captureSha256 !== expectedCaptureSha256) {
    errors.push("captureSha256 does not match the capture payload");
  }
  const keys = new Set<string>();
  for (const response of capture.responses) {
    const key = `${response.jurisdictionId}:${response.indicatorId}`;
    if (keys.has(key)) errors.push(`duplicate response ${key}`);
    keys.add(key);
    if (!/^[A-Z]{2}$/.test(response.iso2)) {
      errors.push(`${key} has an invalid ISO2 code`);
    }
    if (!/^[A-Z]{2,3}$/.test(response.requestCountryCode)) {
      errors.push(`${key} has an invalid World Bank request country code`);
    }
    if (
      !Object.values(WORLD_BANK_ECONOMIC_INDICATORS).includes(
        response.indicatorId as never,
      )
    ) {
      errors.push(`${key} has an undeclared indicator`);
    }
    if (
      response.requestUrl !==
      worldBankRequestUrl(response.requestCountryCode, response.indicatorId)
    ) {
      errors.push(`${key} has an unexpected request URL`);
    }
    if (!Number.isInteger(response.httpStatus)) {
      errors.push(`${key} has an invalid HTTP status`);
    }
    if (!Number.isFinite(Date.parse(response.retrievedAt))) {
      errors.push(`${key} has an invalid retrieval timestamp`);
    }
    if (sha256(response.responseBody) !== response.responseBodySha256) {
      errors.push(`${key} response body hash does not match`);
    }
    try {
      parseWorldBankObservation(response);
    } catch {
      errors.push(`${key} has an invalid response status/body contract`);
    }
  }
  if (expectedJurisdictions) {
    const expectedKeys = new Set(
      expectedJurisdictions.flatMap(({ id }) =>
        Object.values(WORLD_BANK_ECONOMIC_INDICATORS).map(
          (indicatorId) => `${id}:${indicatorId}`,
        )),
    );
    if (keys.size !== expectedKeys.size) {
      errors.push(
        `capture response count ${keys.size} does not match expected ${expectedKeys.size}`,
      );
    }
    for (const key of expectedKeys) {
      if (!keys.has(key)) errors.push(`capture is missing response ${key}`);
    }
    const expectedIso2 = new Map(
      expectedJurisdictions.map(({ id, iso2 }) => [id, iso2.toUpperCase()]),
    );
    const expectedRequestCountryCode = new Map(
      expectedJurisdictions.map(({ id, requestCountryCode }) => [
        id,
        requestCountryCode.toUpperCase(),
      ]),
    );
    for (const response of capture.responses) {
      if (expectedIso2.get(response.jurisdictionId) !== response.iso2) {
        errors.push(
          `${response.jurisdictionId}:${response.indicatorId} does not match the expected ISO2 code`,
        );
      }
      if (
        expectedRequestCountryCode.get(response.jurisdictionId) !==
        response.requestCountryCode
      ) {
        errors.push(
          `${response.jurisdictionId}:${response.indicatorId} does not match the expected World Bank request country code`,
        );
      }
    }
  }
  return errors;
}

function parseWorldBankObservation(
  response: WorldBankEconomicCaptureResponse,
): EconomicComponentObservation {
  let payload: unknown;
  try {
    payload = JSON.parse(response.responseBody);
  } catch {
    throw new Error(
      `World Bank returned invalid JSON for ${response.iso2}/${response.indicatorId}`,
    );
  }
  const countryUnavailableReason =
    recognizedWorldBankCountryUnavailableReason(payload);
  if (countryUnavailableReason) {
    if (response.httpStatus !== 200 && response.httpStatus !== 400) {
      throw new Error(
        `World Bank returned an invalid HTTP status/body pairing for ${response.iso2}/${response.indicatorId}`,
      );
    }
    return {
      value: null,
      referenceYear: null,
      valueStatus: "not_observed",
      valueStatusReason: countryUnavailableReason,
    };
  }
  const emptyObservationReason =
    recognizedWorldBankEmptyObservationReason(payload);
  if (emptyObservationReason) {
    if (response.httpStatus !== 200) {
      throw new Error(
        `World Bank returned an invalid HTTP status/body pairing for ${response.iso2}/${response.indicatorId}`,
      );
    }
    return {
      value: null,
      referenceYear: null,
      valueStatus: "not_observed",
      valueStatusReason: emptyObservationReason,
    };
  }
  if (response.httpStatus !== 200) {
    throw new Error(
      `World Bank returned an invalid HTTP status/body pairing for ${response.iso2}/${response.indicatorId}`,
    );
  }
  if (
    !Array.isArray(payload) ||
    payload.length < 2 ||
    !Array.isArray(payload[1])
  ) {
    throw new Error(
      `World Bank returned an invalid indicator payload for ${response.iso2}/${response.indicatorId}`,
    );
  }
  const points = (payload[1] as Array<{ date?: unknown; value?: unknown }>)
    .filter(
      (point): point is { date: string; value: number } =>
        typeof point?.date === "string" &&
        typeof point?.value === "number" &&
        Number.isFinite(point.value),
    )
    .map((point) => ({
      year: Number.parseInt(point.date, 10),
      value: point.value,
    }))
    .filter((point) => Number.isInteger(point.year))
    .sort((left, right) => right.year - left.year);
  const latest = points[0];
  if (!latest) {
    return {
      value: null,
      referenceYear: null,
      valueStatus: "not_observed",
      valueStatusReason:
        "World Bank returned no non-null observation in the requested period",
    };
  }
  return {
    value: latest.value,
    referenceYear: latest.year,
    valueStatus: "observed",
    valueStatusReason: null,
  };
}

function normalizeWorldBankMessage(value: string): string {
  return value.trim().replace(/[.!]+$/, "");
}

function recognizedWorldBankEmptyObservationReason(
  payload: unknown,
): string | null {
  if (
    !Array.isArray(payload) ||
    payload.length !== 2 ||
    payload[1] !== null ||
    typeof payload[0] !== "object" ||
    payload[0] === null
  ) {
    return null;
  }
  const metadata = payload[0] as Record<string, unknown>;
  const expectedKeys = [
    "lastupdated",
    "page",
    "pages",
    "per_page",
    "sourceid",
    "total",
  ];
  if (
    Object.keys(metadata).sort().join(",") !== expectedKeys.join(",") ||
    metadata.page !== 0 ||
    metadata.pages !== 0 ||
    metadata.per_page !== 0 ||
    metadata.total !== 0 ||
    metadata.sourceid !== null ||
    metadata.lastupdated !== null
  ) {
    return null;
  }
  return "World Bank returned no rows for this jurisdiction and indicator in the requested period";
}

function recognizedWorldBankCountryUnavailableReason(
  payload: unknown,
): string | null {
  if (!Array.isArray(payload) || payload.length !== 1) return null;
  const envelope = payload[0];
  if (
    typeof envelope !== "object" ||
    envelope === null ||
    !("message" in envelope)
  ) {
    return null;
  }
  const messages = (envelope as { message?: unknown }).message;
  if (!Array.isArray(messages) || messages.length !== 1) return null;
  const message = messages[0];
  if (typeof message !== "object" || message === null) return null;
  const { id, key, value } = message as {
    id?: unknown;
    key?: unknown;
    value?: unknown;
  };
  if (
    typeof id !== "string" ||
    id.trim().length === 0 ||
    typeof key !== "string" ||
    key.trim().length === 0 ||
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    return null;
  }
  if (
    id.trim() === "120" &&
    normalizeWorldBankMessage(key) === "Invalid value" &&
    normalizeWorldBankMessage(value) ===
      "The provided parameter value is not valid"
  ) {
    return "World Bank does not support this jurisdiction's country code";
  }
  return null;
}

export async function captureWorldBankEconomicInputs(input: {
  jurisdictions: readonly {
    id: string;
    iso2: string;
    requestCountryCode: string;
  }[];
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): Promise<WorldBankEconomicCapture> {
  if (!input.jurisdictions.length) {
    throw new Error("World Bank economic capture has no jurisdictions");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());
  const jobs = input.jurisdictions.flatMap((jurisdiction) => {
    const iso2 = jurisdiction.iso2.toUpperCase();
    const requestCountryCode = jurisdiction.requestCountryCode.toUpperCase();
    return Object.values(WORLD_BANK_ECONOMIC_INDICATORS).map((indicatorId) => ({
      jurisdictionId: jurisdiction.id,
      iso2,
      requestCountryCode,
      indicatorId,
    }));
  });
  const responses = new Array<WorldBankEconomicCaptureResponse>(jobs.length);
  let nextJobIndex = 0;
  async function worker(): Promise<void> {
    while (nextJobIndex < jobs.length) {
      const jobIndex = nextJobIndex;
      nextJobIndex += 1;
      const {
        jurisdictionId,
        iso2,
        requestCountryCode,
        indicatorId,
      } = jobs[jobIndex];
      const requestUrl = worldBankRequestUrl(requestCountryCode, indicatorId);
      let response: Response;
      try {
        response = await fetchImpl(requestUrl);
      } catch (error) {
        throw new Error(
          `World Bank transport failed for ${requestCountryCode}/${indicatorId}`,
          { cause: error },
        );
      }
      if (response.status !== 200 && response.status !== 400) {
        throw new Error(
          `World Bank request returned HTTP ${response.status} for ${requestCountryCode}/${indicatorId}`,
        );
      }
      const responseBody = await response.text();
      const capturedResponse = {
        jurisdictionId,
        iso2,
        requestCountryCode,
        indicatorId,
        requestUrl,
        httpStatus: response.status,
        retrievedAt: now().toISOString(),
        responseBodySha256: sha256(responseBody),
        responseBody,
      };
      // Parse now so malformed responses fail before a capture can publish.
      parseWorldBankObservation(capturedResponse);
      responses[jobIndex] = capturedResponse;
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(WORLD_BANK_CAPTURE_CONCURRENCY, jobs.length) },
      () => worker(),
    ),
  );
  const capture = buildWorldBankEconomicCapture(responses);
  const errors = validateWorldBankEconomicCapture(capture, input.jurisdictions);
  if (errors.length) {
    throw new Error(`Invalid World Bank economic capture: ${errors.join(", ")}`);
  }
  return capture;
}

export async function readWorldBankEconomicCapture(
  path: string,
): Promise<WorldBankEconomicCapture> {
  const capture = JSON.parse(
    await readFile(path, "utf8"),
  ) as WorldBankEconomicCapture;
  const errors = validateWorldBankEconomicCapture(capture);
  if (errors.length) {
    throw new Error(`Invalid World Bank economic capture: ${errors.join(", ")}`);
  }
  return capture;
}

export async function writeWorldBankEconomicCapture(
  path: string,
  capture: WorldBankEconomicCapture,
): Promise<void> {
  const errors = validateWorldBankEconomicCapture(capture);
  if (errors.length) {
    throw new Error(`Invalid World Bank economic capture: ${errors.join(", ")}`);
  }
  // Refuse overwrite: a capture is an immutable input, not a mutable cache.
  await writeFile(path, `${JSON.stringify(capture, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

export function worldBankEconomicObservationsFromCapture(
  capture: WorldBankEconomicCapture,
  expectedJurisdictions: readonly ConditionsCoverageAdmissionJurisdiction[],
): EconomicObservation[] {
  const errors = validateWorldBankEconomicCapture(
    capture,
    expectedJurisdictions,
  );
  if (errors.length) {
    throw new Error(`Invalid World Bank economic capture: ${errors.join(", ")}`);
  }
  const byKey = new Map(
    capture.responses.map((response) => [
      `${response.jurisdictionId}:${response.indicatorId}`,
      response,
    ]),
  );
  const observations = expectedJurisdictions.map(({ id }) => ({
    jurisdictionId: id,
    inflation: parseWorldBankObservation(
      byKey.get(`${id}:${WORLD_BANK_ECONOMIC_INDICATORS.inflation}`)!,
    ),
    unemployment: parseWorldBankObservation(
      byKey.get(`${id}:${WORLD_BANK_ECONOMIC_INDICATORS.unemployment}`)!,
    ),
    gdpGrowth: parseWorldBankObservation(
      byKey.get(`${id}:${WORLD_BANK_ECONOMIC_INDICATORS.gdpGrowth}`)!,
    ),
  }));
  const coverageAdmissionJurisdictionIds = new Set(
    expectedJurisdictions
      .filter(isConditionsCoverageAdmissionEligible)
      .map(({ id }) => id),
  );
  const coverageAdmissionObservations = observations.filter(({ jurisdictionId }) =>
    coverageAdmissionJurisdictionIds.has(jurisdictionId),
  );
  if (!coverageAdmissionObservations.length) {
    throw new Error(
      `World Bank coverage failed closed: no ${CONDITIONS_COVERAGE_ADMISSION_JURISDICTION_STATUS} jurisdictions are eligible for coverage admission`,
    );
  }
  const minimumObserved = Math.max(
    1,
    Math.ceil(
      coverageAdmissionObservations.length *
        WORLD_BANK_ECONOMIC_MINIMUM_COVERAGE_RATIO,
    ),
  );
  const componentObservations = {
    inflation: coverageAdmissionObservations.map(
      (observation) => observation.inflation,
    ),
    unemployment: coverageAdmissionObservations.map(
      (observation) => observation.unemployment,
    ),
    gdpGrowth: coverageAdmissionObservations.map(
      (observation) => observation.gdpGrowth,
    ),
  };
  for (const [component, componentRows] of Object.entries(
    componentObservations,
  )) {
    const observed = componentRows.filter(
      (observation) => observation.valueStatus === "observed",
    ).length;
    if (observed === 0) {
      throw new Error(
        `World Bank coverage failed closed: ${component} has zero observed jurisdictions`,
      );
    }
    if (observed < minimumObserved) {
      throw new Error(
        `World Bank coverage failed closed: ${component} has ${observed} observed jurisdictions; required at least ${minimumObserved} of ${coverageAdmissionObservations.length} ${CONDITIONS_COVERAGE_ADMISSION_JURISDICTION_STATUS} jurisdictions`,
      );
    }
  }
  const alignedJurisdictions = new Set(
    buildEconomicReferenceSets(coverageAdmissionObservations).flatMap(
      (referenceSet) => referenceSet.jurisdictionIds,
    ),
  ).size;
  if (alignedJurisdictions < minimumObserved) {
    throw new Error(
      `World Bank coverage failed closed: aligned all-component reference sets cover ${alignedJurisdictions} jurisdictions; required at least ${minimumObserved} of ${coverageAdmissionObservations.length} ${CONDITIONS_COVERAGE_ADMISSION_JURISDICTION_STATUS} jurisdictions`,
    );
  }
  return observations;
}

function aggregateResponseBodyHash(
  responses: readonly WorldBankEconomicCaptureResponse[],
): string {
  return sha256(
    stableStringify(
      responses
        .map(({ jurisdictionId, indicatorId, responseBodySha256 }) => ({
          jurisdictionId,
          indicatorId,
          responseBodySha256,
        }))
        .sort((left, right) =>
          compareText(
            `${left.jurisdictionId}:${left.indicatorId}`,
            `${right.jurisdictionId}:${right.indicatorId}`,
          )),
    ),
  );
}

function economicLineages(
  observations: readonly EconomicObservation[],
  capture: WorldBankEconomicCapture,
): EconomicLineages {
  const common = {
    sourceId: WORLD_BANK_SOURCE_ID,
    dimension: "economic_stability",
    upstreamRelease:
      `World Bank API indicators ${WORLD_BANK_ECONOMIC_DATE_RANGE}; capture ${capture.captureSha256}`,
    temporalCoverage: WORLD_BANK_ECONOMIC_DATE_RANGE.replace(":", "/"),
    methodVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  };
  const responsesFor = (indicatorId: string) =>
    capture.responses.filter((response) => response.indicatorId === indicatorId);
  return {
    score: buildIndicatorLineage({
      ...common,
      transformationId: "conditions-economic-source-native/v1",
      rows: observations,
      publisherArtifactHash: aggregateResponseBodyHash(capture.responses),
    }),
    components: {
      inflation: buildIndicatorLineage({
        ...common,
        indicatorId: WORLD_BANK_ECONOMIC_INDICATORS.inflation,
        transformationId: "conditions-economic-component/v1",
        rows: observations.map(({ jurisdictionId, inflation }) => ({
          jurisdictionId,
          ...inflation,
        })),
        publisherArtifactHash: aggregateResponseBodyHash(
          responsesFor(WORLD_BANK_ECONOMIC_INDICATORS.inflation),
        ),
      }),
      unemployment: buildIndicatorLineage({
        ...common,
        indicatorId: WORLD_BANK_ECONOMIC_INDICATORS.unemployment,
        transformationId: "conditions-economic-component/v1",
        rows: observations.map(({ jurisdictionId, unemployment }) => ({
          jurisdictionId,
          ...unemployment,
        })),
        publisherArtifactHash: aggregateResponseBodyHash(
          responsesFor(WORLD_BANK_ECONOMIC_INDICATORS.unemployment),
        ),
      }),
      gdp_growth: buildIndicatorLineage({
        ...common,
        indicatorId: WORLD_BANK_ECONOMIC_INDICATORS.gdpGrowth,
        transformationId: "conditions-economic-component/v1",
        rows: observations.map(({ jurisdictionId, gdpGrowth }) => ({
          jurisdictionId,
          ...gdpGrowth,
        })),
        publisherArtifactHash: aggregateResponseBodyHash(
          responsesFor(WORLD_BANK_ECONOMIC_INDICATORS.gdpGrowth),
        ),
      }),
    },
  };
}

export async function prepareEconomicConditions(
  db: ConditionsDb,
  releaseId: string,
  options: EconomicInputOptions,
): Promise<PreparedConditionsDimension> {
  if (Boolean(options.inputFile) === Boolean(options.captureOutput)) {
    throw new Error(
      "Pass exactly one of --economic-input=<capture.json> or --economic-capture-output=<capture.json>",
    );
  }
  const jurisdictionRows = await db
    .select({
      id: jurisdictions.id,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
      jurisdictionStatus: jurisdictions.type,
    })
    .from(jurisdictions)
    .where(isNotNull(jurisdictions.iso2));
  const expectedJurisdictions = jurisdictionRows
    .filter(
      (
        row,
      ): row is {
        id: string;
        iso2: string;
        iso3: string | null;
        jurisdictionStatus: string;
      } =>
        typeof row.iso2 === "string" && /^[A-Za-z]{2}$/.test(row.iso2),
    )
    .map((row) => ({
      id: row.id,
      iso2: row.iso2.toUpperCase(),
      requestCountryCode: worldBankRequestCountryCode(row),
      jurisdictionStatus: row.jurisdictionStatus,
    }));
  if (!expectedJurisdictions.length) {
    throw new Error("No jurisdictions with ISO2 codes are available");
  }
  const capture = options.inputFile
    ? await readWorldBankEconomicCapture(options.inputFile)
    : await captureWorldBankEconomicInputs({
        jurisdictions: expectedJurisdictions,
        fetchImpl: options.fetchImpl,
        now: options.now,
      });
  if (options.captureOutput) {
    await writeWorldBankEconomicCapture(options.captureOutput, capture);
  }
  const observations = worldBankEconomicObservationsFromCapture(
    capture,
    expectedJurisdictions,
  );
  const rows = buildEconomicConditionsCalculations({
    observations,
    releaseId,
    methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
    lineages: economicLineages(observations, capture),
  });
  const referenceSets = buildEconomicReferenceSets(observations);
  if (!referenceSets.length) {
    throw new Error(
      "World Bank coverage failed closed: no jurisdiction has all economic components aligned to one reference year",
    );
  }
  const expectedCalculationCount = expectedJurisdictions.length;
  assertExpectedCalculationCount(
    "economic_stability",
    rows,
    expectedCalculationCount,
  );
  return {
    rows,
    referenceSets,
    expectedCalculationCount,
  };
}

export async function runCombinedConditionsIngestion(
  db: ConditionsDb,
  options: RunConditionsWorkflowOptions,
) {
  if (!/^conditions-[a-z0-9-]+-v[1-9][0-9]*$/.test(options.releaseId)) {
    throw new Error("Pass a stable --release-id=conditions-*-vN; releases are never implicit");
  }
  if (!options.dryRun && !options.releaseExpectations) {
    throw new Error(
      "Conditions apply requires a pre-write release expectations artifact",
    );
  }
  const dependencies: ConditionsWorkflowDependencies = {
    prepareHdi: prepareHdiConditions,
    prepareGpi: prepareGpiConditions,
    prepareEconomic: prepareEconomicConditions,
    writeRelease: writeConditionsRelease,
    ...options.dependencies,
  };
  const [hdi, gpi, economic] = await Promise.all([
    dependencies.prepareHdi(db, options.releaseId),
    dependencies.prepareGpi(db, options.releaseId),
    dependencies.prepareEconomic(db, options.releaseId, {
      inputFile: options.inputFile,
      captureOutput: options.captureOutput,
      fetchImpl: options.fetchImpl,
      now: options.now,
    }),
  ]);
  assertExpectedCalculationCount(
    "human_development",
    hdi.rows,
    hdi.expectedCalculationCount,
  );
  assertExpectedCalculationCount(
    "peace_security",
    gpi.rows,
    gpi.expectedCalculationCount,
  );
  assertExpectedCalculationCount(
    "economic_stability",
    economic.rows,
    economic.expectedCalculationCount,
  );
  const expectedCalculationCounts = {
    human_development: hdi.expectedCalculationCount,
    peace_security: gpi.expectedCalculationCount,
    economic_stability: economic.expectedCalculationCount,
  } satisfies ConditionsExpectedCalculationCounts;
  const release: ConditionsReleaseInput = {
    releaseId: options.releaseId,
    methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
    referenceSets: [
      ...hdi.referenceSets,
      ...gpi.referenceSets,
      ...economic.referenceSets,
    ],
  };
  const rows = [...hdi.rows, ...gpi.rows, ...economic.rows];
  const releaseManifestSha256 = conditionsReleaseManifestSha256(release, rows);
  if (options.releaseExpectations) {
    if (
      releaseManifestSha256 !==
      options.releaseExpectations.releaseManifestSha256
    ) {
      throw new Error(
        "Conditions prepared manifest does not match the pre-write expectations artifact",
      );
    }
    for (const dimension of CONDITIONS_DIMENSIONS) {
      if (
        expectedCalculationCounts[dimension] !==
        options.releaseExpectations.expectedCalculationCounts[dimension]
      ) {
        throw new Error(
          `Conditions ${dimension} count does not match the pre-write expectations artifact`,
        );
      }
    }
  }
  const summary = await dependencies.writeRelease(db, release, rows, {
    dryRun: options.dryRun,
  });
  return {
    release,
    rows,
    summary,
    expectedCalculationCounts,
    releaseManifestSha256,
  };
}
