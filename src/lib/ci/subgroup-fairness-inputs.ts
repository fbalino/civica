import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { CIDimensionV2 } from "./dimensions-v2";

export const SUBGROUP_FAIRNESS_INPUTS_SCHEMA_VERSION =
  "civica-index-subgroup-fairness-inputs/v1" as const;

export interface SubgroupFairnessPanelRow {
  iso3: string;
  dimension: CIDimensionV2;
  sourceId: string;
  indicatorId: string;
  value: number | null;
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
}

export interface SubgroupFairnessUncertaintyRow {
  iso3: string;
  dimension: string;
  lower: number | null;
  upper: number | null;
}

export interface SubgroupFairnessMediaRow {
  iso3: string;
  value: number;
}

export interface SubgroupFairnessMetadataRow {
  iso3: string;
  region: string;
  population: number;
  disputed: boolean;
  regime: string | null;
}

export interface SubgroupFairnessInputs {
  schemaVersion: typeof SUBGROUP_FAIRNESS_INPUTS_SCHEMA_VERSION;
  panel: SubgroupFairnessPanelRow[];
  uncertainty: SubgroupFairnessUncertaintyRow[];
  media: SubgroupFairnessMediaRow[];
  metadata: SubgroupFairnessMetadataRow[];
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid subgroup fairness input ${label}`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label);
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid subgroup fairness input ${label}`);
  }
  return value;
}

function nullableNumber(value: unknown, label: string): number | null {
  return value === null ? null : number(value, label);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid subgroup fairness input ${label}`);
  }
  return value;
}

function array(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`Invalid subgroup fairness input ${label}`);
  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Invalid subgroup fairness input ${label}[${index}]`);
    }
    return row as Record<string, unknown>;
  });
}

function sortBy<T>(rows: T[], select: (row: T) => string): T[] {
  return [...rows].sort((left, right) => select(left).localeCompare(select(right)));
}

/**
 * Validates and canonically orders the restricted normalized inputs before
 * they are content-addressed. The public release stores the resulting hash,
 * never these source-derived values.
 */
export function normalizeSubgroupFairnessInputs(value: unknown): SubgroupFairnessInputs {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid subgroup fairness input snapshot");
  }
  const root = value as Record<string, unknown>;
  if (root.schemaVersion !== SUBGROUP_FAIRNESS_INPUTS_SCHEMA_VERSION) {
    throw new Error(`Unexpected subgroup fairness input schema ${String(root.schemaVersion)}`);
  }
  const panel = sortBy(array(root.panel, "panel").map((row, index) => ({
    iso3: string(row.iso3, `panel[${index}].iso3`),
    dimension: string(row.dimension, `panel[${index}].dimension`) as CIDimensionV2,
    sourceId: string(row.sourceId, `panel[${index}].sourceId`),
    indicatorId: string(row.indicatorId, `panel[${index}].indicatorId`),
    value: nullableNumber(row.value, `panel[${index}].value`),
    nativeMin: number(row.nativeMin, `panel[${index}].nativeMin`),
    nativeMax: number(row.nativeMax, `panel[${index}].nativeMax`),
    isInverted: boolean(row.isInverted, `panel[${index}].isInverted`),
  })), (row) => `${row.iso3}\u0000${row.sourceId}\u0000${row.indicatorId}`);
  const uncertainty = sortBy(array(root.uncertainty, "uncertainty").map((row, index) => ({
    iso3: string(row.iso3, `uncertainty[${index}].iso3`),
    dimension: string(row.dimension, `uncertainty[${index}].dimension`),
    lower: nullableNumber(row.lower, `uncertainty[${index}].lower`),
    upper: nullableNumber(row.upper, `uncertainty[${index}].upper`),
  })), (row) => `${row.iso3}\u0000${row.dimension}`);
  const media = sortBy(array(root.media, "media").map((row, index) => ({
    iso3: string(row.iso3, `media[${index}].iso3`),
    value: number(row.value, `media[${index}].value`),
  })), (row) => row.iso3);
  const metadata = sortBy(array(root.metadata, "metadata").map((row, index) => ({
    iso3: string(row.iso3, `metadata[${index}].iso3`),
    region: string(row.region, `metadata[${index}].region`),
    population: number(row.population, `metadata[${index}].population`),
    disputed: boolean(row.disputed, `metadata[${index}].disputed`),
    regime: nullableString(row.regime, `metadata[${index}].regime`),
  })), (row) => row.iso3);
  return {
    schemaVersion: SUBGROUP_FAIRNESS_INPUTS_SCHEMA_VERSION,
    panel,
    uncertainty,
    media,
    metadata,
  };
}

export function subgroupFairnessInputBytes(value: SubgroupFairnessInputs): Buffer {
  return Buffer.from(`${JSON.stringify(normalizeSubgroupFairnessInputs(value), null, 2)}\n`);
}

export function subgroupFairnessInputSha256(value: SubgroupFairnessInputs): string {
  return sha256(subgroupFairnessInputBytes(value));
}

function protectedInputPath(directory: string, contentSha256: string): string {
  if (!/^[a-f0-9]{64}$/.test(contentSha256)) {
    throw new Error(`Invalid subgroup fairness input hash ${contentSha256}`);
  }
  return join(resolve(directory), "sha256", contentSha256);
}

/** Reads exact restricted analysis inputs without opening a database connection. */
export function readProtectedSubgroupFairnessInputs(
  contentSha256: string,
  directory = process.env.CIVICA_RESEARCH_INPUT_DIR,
): SubgroupFairnessInputs {
  if (!directory) {
    throw new Error(
      "Missing protected subgroup fairness input cache. Set CIVICA_RESEARCH_INPUT_DIR; live database access is disabled during replay.",
    );
  }
  const path = protectedInputPath(directory, contentSha256);
  if (!existsSync(path)) {
    throw new Error(
      `Missing retained subgroup fairness input ${contentSha256}. Set CIVICA_RESEARCH_INPUT_DIR to the protected cache; live database access is disabled during replay.`,
    );
  }
  const bytes = readFileSync(path);
  const actual = sha256(bytes);
  if (actual !== contentSha256) {
    throw new Error(`retained subgroup fairness input hash drift ${path}: expected ${contentSha256}, got ${actual}`);
  }
  return normalizeSubgroupFairnessInputs(JSON.parse(bytes.toString("utf8")));
}

/**
 * Persists a newly captured restricted input only in the caller-selected
 * protected cache. It is intentionally not a repository write path.
 */
export function retainProtectedSubgroupFairnessInputs(
  value: SubgroupFairnessInputs,
  directory = process.env.CIVICA_RESEARCH_INPUT_DIR,
): { contentSha256: string; path: string } {
  if (!directory) {
    throw new Error("CIVICA_RESEARCH_INPUT_DIR is required to retain subgroup fairness inputs");
  }
  const bytes = subgroupFairnessInputBytes(value);
  const contentSha256 = sha256(bytes);
  const path = protectedInputPath(directory, contentSha256);
  mkdirSync(resolve(path, ".."), { recursive: true });
  if (existsSync(path)) {
    const existing = readFileSync(path);
    if (sha256(existing) !== contentSha256) {
      throw new Error(`protected subgroup fairness input path is not content-addressed: ${path}`);
    }
  } else {
    writeFileSync(path, bytes);
  }
  return { contentSha256, path };
}
