import { createHash } from "node:crypto";
import type { CIDimension } from "./types";
import type { IndicatorLineage } from "@/lib/indicators/lineage";

export const REQUIRED_CI_ADAPTERS = [
  "vdem:democratic_quality",
  "worldbank_wgi:rule_of_law",
  "worldbank_wgi:democratic_quality",
  "freedom_house:freedom_rights",
  "transparency_intl:corruption_control",
] as const;

export const MINIMUM_CI_STAGE_COVERAGE: Record<(typeof REQUIRED_CI_ADAPTERS)[number], number> = {
  "vdem:democratic_quality": 160,
  "worldbank_wgi:rule_of_law": 180,
  "worldbank_wgi:democratic_quality": 1,
  "freedom_house:freedom_rights": 180,
  "transparency_intl:corruption_control": 170,
};

export interface StagedCiRow extends IndicatorLineage {
  jurisdictionId: string;
  iso3: string;
  normalizedScore: number;
  rawValue: number;
  sourceId: string;
  dimension: CIDimension;
  quarter: string;
  methodologyVersion: string;
  releaseId: string;
  derivationVersionKey: string;
  derivationVersions: unknown;
}

export interface StagedCiAdapter {
  schemaVersion: "ci-atomic-stage/v1";
  adapterKey: string;
  sourceId: string;
  dimension: CIDimension;
  datasetYear: number;
  quarter: string;
  methodologyVersion: string;
  releaseId: string;
  nativeScaleMin: number;
  nativeScaleMax: number;
  isInverted: boolean;
  globalMinObserved: number;
  globalMaxObserved: number;
  countriesCovered: number;
  skipped: number;
  rows: StagedCiRow[];
}

export function canonicalStageChecksum(stages: StagedCiAdapter[]): string {
  const canonical = [...stages]
    .sort((a, b) => a.adapterKey.localeCompare(b.adapterKey))
    .map((stage) => ({
      ...stage,
      rows: [...stage.rows].sort((a, b) => `${a.jurisdictionId}:${a.dimension}`.localeCompare(`${b.jurisdictionId}:${b.dimension}`)),
    }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function validateStagedCiRelease(stages: StagedCiAdapter[]): string[] {
  const errors: string[] = [];
  const keys = stages.map((stage) => stage.adapterKey).sort();
  const required = [...REQUIRED_CI_ADAPTERS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(required)) errors.push("staged adapter set is incomplete or duplicated");
  const years = new Set(stages.map((stage) => stage.datasetYear));
  const quarters = new Set(stages.map((stage) => stage.quarter));
  const methods = new Set(stages.map((stage) => stage.methodologyVersion));
  const releases = new Set(stages.map((stage) => stage.releaseId));
  if (years.size !== 1 || quarters.size !== 1 || methods.size !== 1 || releases.size !== 1) errors.push("staged adapters disagree on dataset year, quarter, methodology version, or release id");
  for (const stage of stages) {
    if (stage.schemaVersion !== "ci-atomic-stage/v1") errors.push(`${stage.adapterKey}: unsupported stage schema`);
    if (stage.rows.length === 0 || stage.countriesCovered !== stage.rows.length) errors.push(`${stage.adapterKey}: empty or inconsistent coverage`);
    const minimum = MINIMUM_CI_STAGE_COVERAGE[stage.adapterKey as keyof typeof MINIMUM_CI_STAGE_COVERAGE];
    if (minimum == null || stage.rows.length < minimum) errors.push(`${stage.adapterKey}: coverage ${stage.rows.length} below required ${minimum ?? "unknown"}`);
    if (stage.rows.some((row) => !/^[A-Z]{3}$/.test(row.iso3) || row.sourceId !== stage.sourceId || row.dimension !== stage.dimension || row.quarter !== stage.quarter || row.methodologyVersion !== stage.methodologyVersion || row.releaseId !== stage.releaseId || !row.indicatorId || !row.artifactHash)) errors.push(`${stage.adapterKey}: row metadata drift`);
    if (new Set(stage.rows.map((row) => row.jurisdictionId)).size !== stage.rows.length) errors.push(`${stage.adapterKey}: duplicate jurisdiction rows`);
  }
  const scoreKeys = new Set<string>();
  for (const stage of stages) for (const row of stage.rows) {
    const key = `${row.jurisdictionId}:${row.dimension}:${row.sourceId}:${row.indicatorId}`;
    if (scoreKeys.has(key)) errors.push(`overlapping staged score identity: ${key}`);
    scoreKeys.add(key);
  }
  return errors;
}
