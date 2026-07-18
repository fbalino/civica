import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const INDEX_ANALYSIS_INPUTS_SCHEMA_VERSION =
  "civica-index-analysis-inputs/v1" as const;
export const INDEX_ANALYSIS_INPUT_RELEASE_ID =
  "ci-index-analysis-replay-inputs-2026-07-18-v1" as const;
export const INDEX_ANALYSIS_INPUT_MANIFEST_PATH =
  `data/releases/${INDEX_ANALYSIS_INPUT_RELEASE_ID}/manifest.v1.json` as const;

export interface IndexAnalysisPanelRow {
  jurisdictionId: string;
  iso3: string;
  periodYear: number;
  dimension: string;
  sourceId: string;
  indicatorId: string;
  value: number | null;
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
}

export interface IndexAnalysisUncertaintyRow extends IndexAnalysisPanelRow {
  lower: number | null;
  upper: number | null;
}

export interface IndexAnalysisLongitudinalLabelRow {
  iso3: string;
  year: number;
  value: number;
}

export interface IndexAnalysisMetadataRow {
  iso3: string;
  region: string | null;
  regime: string | null;
}

export interface IndexAnalysisInputs {
  schemaVersion: typeof INDEX_ANALYSIS_INPUTS_SCHEMA_VERSION;
  panel: IndexAnalysisPanelRow[];
  uncertainty: IndexAnalysisUncertaintyRow[];
  longitudinalLabels: IndexAnalysisLongitudinalLabelRow[];
  metadata: IndexAnalysisMetadataRow[];
}

interface IndexAnalysisReplayManifest {
  schemaVersion: "civica-index-analysis-replay-inputs/v1";
  releaseId: typeof INDEX_ANALYSIS_INPUT_RELEASE_ID;
  protectedInput: {
    schemaVersion: typeof INDEX_ANALYSIS_INPUTS_SCHEMA_VERSION;
    contentSha256: string;
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid Index analysis input ${label}`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`Invalid Index analysis input ${label}`);
  return value.map((row, index) => object(row, `${label}[${index}]`));
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid Index analysis input ${label}`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label);
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid Index analysis input ${label}`);
  }
  return value;
}

function nullableNumber(value: unknown, label: string): number | null {
  return value === null ? null : number(value, label);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Invalid Index analysis input ${label}`);
  return value;
}

function panelRow(
  row: Record<string, unknown>,
  label: string,
): IndexAnalysisPanelRow {
  return {
    jurisdictionId: string(row.jurisdictionId, `${label}.jurisdictionId`),
    iso3: string(row.iso3, `${label}.iso3`),
    periodYear: number(row.periodYear, `${label}.periodYear`),
    dimension: string(row.dimension, `${label}.dimension`),
    sourceId: string(row.sourceId, `${label}.sourceId`),
    indicatorId: string(row.indicatorId, `${label}.indicatorId`),
    value: nullableNumber(row.value, `${label}.value`),
    nativeMin: number(row.nativeMin, `${label}.nativeMin`),
    nativeMax: number(row.nativeMax, `${label}.nativeMax`),
    isInverted: boolean(row.isInverted, `${label}.isInverted`),
  };
}

function sorted<T>(rows: T[], key: (row: T) => string): T[] {
  return [...rows].sort((left, right) => key(left).localeCompare(key(right)));
}

/**
 * Normalizes and validates every private input needed by the Index research
 * analysis suite. The bytes are retained only in the protected local cache.
 */
export function normalizeIndexAnalysisInputs(value: unknown): IndexAnalysisInputs {
  const root = object(value, "snapshot");
  if (root.schemaVersion !== INDEX_ANALYSIS_INPUTS_SCHEMA_VERSION) {
    throw new Error(`Unexpected Index analysis input schema ${String(root.schemaVersion)}`);
  }
  const panel = sorted(
    array(root.panel, "panel").map((row, index) => panelRow(row, `panel[${index}]`)),
    (row) => `${row.iso3}\u0000${row.periodYear}\u0000${row.sourceId}\u0000${row.indicatorId}`,
  );
  const uncertainty = sorted(
    array(root.uncertainty, "uncertainty").map((row, index) => ({
      ...panelRow(row, `uncertainty[${index}]`),
      lower: nullableNumber(row.lower, `uncertainty[${index}].lower`),
      upper: nullableNumber(row.upper, `uncertainty[${index}].upper`),
    })),
    (row) => `${row.iso3}\u0000${row.periodYear}\u0000${row.sourceId}\u0000${row.indicatorId}`,
  );
  const longitudinalLabels = sorted(
    array(root.longitudinalLabels, "longitudinalLabels").map((row, index) => ({
      iso3: string(row.iso3, `longitudinalLabels[${index}].iso3`),
      year: number(row.year, `longitudinalLabels[${index}].year`),
      value: number(row.value, `longitudinalLabels[${index}].value`),
    })),
    (row) => `${row.iso3}\u0000${row.year}`,
  );
  const metadata = sorted(
    array(root.metadata, "metadata").map((row, index) => ({
      iso3: string(row.iso3, `metadata[${index}].iso3`),
      region: nullableString(row.region, `metadata[${index}].region`),
      regime: nullableString(row.regime, `metadata[${index}].regime`),
    })),
    (row) => row.iso3,
  );
  return {
    schemaVersion: INDEX_ANALYSIS_INPUTS_SCHEMA_VERSION,
    panel,
    uncertainty,
    longitudinalLabels,
    metadata,
  };
}

export function indexAnalysisInputBytes(value: IndexAnalysisInputs): Buffer {
  return Buffer.from(`${JSON.stringify(normalizeIndexAnalysisInputs(value), null, 2)}\n`);
}

export function indexAnalysisInputSha256(value: IndexAnalysisInputs): string {
  return sha256(indexAnalysisInputBytes(value));
}

function cachePath(directory: string, contentSha256: string): string {
  if (!/^[a-f0-9]{64}$/.test(contentSha256)) {
    throw new Error(`Invalid Index analysis input hash ${contentSha256}`);
  }
  return join(resolve(directory), "sha256", contentSha256);
}

export function retainProtectedIndexAnalysisInputs(
  value: IndexAnalysisInputs,
  directory = process.env.CIVICA_RESEARCH_INPUT_DIR,
): { contentSha256: string; path: string } {
  if (!directory) throw new Error("CIVICA_RESEARCH_INPUT_DIR is required to retain Index analysis inputs");
  const bytes = indexAnalysisInputBytes(value);
  const contentSha256 = sha256(bytes);
  const path = cachePath(directory, contentSha256);
  mkdirSync(resolve(path, ".."), { recursive: true });
  if (existsSync(path)) {
    if (sha256(readFileSync(path)) !== contentSha256) {
      throw new Error(`protected Index analysis input path is not content-addressed: ${path}`);
    }
  } else {
    writeFileSync(path, bytes);
  }
  return { contentSha256, path };
}

export function readProtectedIndexAnalysisInputs(
  contentSha256: string,
  directory = process.env.CIVICA_RESEARCH_INPUT_DIR,
): IndexAnalysisInputs {
  if (!directory) {
    throw new Error(
      "Missing protected Index analysis input cache. Set CIVICA_RESEARCH_INPUT_DIR; live database access is disabled during replay.",
    );
  }
  const path = cachePath(directory, contentSha256);
  if (!existsSync(path)) {
    throw new Error(
      `Missing retained Index analysis input ${contentSha256}. Set CIVICA_RESEARCH_INPUT_DIR to the protected cache; live database access is disabled during replay.`,
    );
  }
  const bytes = readFileSync(path);
  const actual = sha256(bytes);
  if (actual !== contentSha256) {
    throw new Error(`retained Index analysis input hash drift ${path}: expected ${contentSha256}, got ${actual}`);
  }
  return normalizeIndexAnalysisInputs(JSON.parse(bytes.toString("utf8")));
}

export function readIndexAnalysisReplayInputs(): IndexAnalysisInputs {
  const manifest = JSON.parse(readFileSync(INDEX_ANALYSIS_INPUT_MANIFEST_PATH, "utf8")) as Partial<IndexAnalysisReplayManifest>;
  if (
    manifest.schemaVersion !== "civica-index-analysis-replay-inputs/v1" ||
    manifest.releaseId !== INDEX_ANALYSIS_INPUT_RELEASE_ID ||
    manifest.protectedInput?.schemaVersion !== INDEX_ANALYSIS_INPUTS_SCHEMA_VERSION ||
    !/^[a-f0-9]{64}$/.test(manifest.protectedInput.contentSha256 ?? "")
  ) {
    throw new Error(`Invalid frozen Index analysis replay manifest ${INDEX_ANALYSIS_INPUT_MANIFEST_PATH}`);
  }
  return readProtectedIndexAnalysisInputs(manifest.protectedInput.contentSha256);
}
