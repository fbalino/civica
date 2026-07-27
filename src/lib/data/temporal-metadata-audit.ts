import { createHash } from "node:crypto";

import {
  BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR,
  BJORNKSKOV_RODE_DATASET_VERSION,
  BJORNKSKOV_RODE_SOURCE_DATASET_VERSION,
} from "../government-taxonomy";
import { TEMPORAL_METADATA_VERSION } from "./temporal-metadata";

export const TEMPORAL_METADATA_AUDIT_VERSION =
  "temporal-metadata-audit/v1" as const;
export const TEMPORAL_METADATA_AUDIT_SOURCE =
  "production_neon_read_only_aggregate" as const;
export const DAT_025_BRCGV_PUBLICATION_VERSION = "2026_v1" as const;

export interface TemporalMetadataAuditReportBody {
  schemaVersion: typeof TEMPORAL_METADATA_AUDIT_VERSION;
  checkedAt: string;
  contract: typeof TEMPORAL_METADATA_VERSION;
  auditSource: typeof TEMPORAL_METADATA_AUDIT_SOURCE;
  readOnly: true;
  atlasVintage: {
    rows: number;
    observationReferenceYearPresent: number;
    upstreamDatasetReleasePresent: number;
    sourceRetrievedAtPresent: number;
    civicaPublicationVersionPresent: number;
    publicationVersionMismatches: number;
    postCutRetrievalsRetained: number;
  };
  bjornskovRodeCgv: {
    rows: number;
    observationReferenceYear: number;
    sourceDatasetRelease: string;
    distributionRelease: string;
    retrievedAt: string;
    civicaPublicationVersion: string;
    temporalMismatches: number;
  };
  writesPerformedByAudit: number;
}

export interface TemporalMetadataAuditReport extends TemporalMetadataAuditReportBody {
  semanticSha256: string;
}

function stableStringify(value: unknown): string {
  if (value === undefined || value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function temporalMetadataAuditSemanticSha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function buildTemporalMetadataAuditReport(
  body: TemporalMetadataAuditReportBody,
): TemporalMetadataAuditReport {
  return {
    ...body,
    semanticSha256: temporalMetadataAuditSemanticSha256(body),
  };
}

function asRecord(
  value: unknown,
  label: string,
  errors: string[],
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return null;
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  label: string,
  errors: string[],
): void {
  const expectedSet = new Set(expected);
  for (const key of expected) {
    if (!(key in record)) errors.push(`${label} is missing ${key}`);
  }
  for (const key of Object.keys(record)) {
    if (!expectedSet.has(key))
      errors.push(`${label} has unexpected field ${key}`);
  }
}

function nonNegativeInteger(
  value: unknown,
  label: string,
  errors: string[],
): number | null {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    errors.push(`${label} must be a non-negative safe integer`);
    return null;
  }
  return Number(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
}

function withoutSemanticHash(
  report: Record<string, unknown>,
): Record<string, unknown> {
  const body = { ...report };
  delete body.semanticSha256;
  return body;
}

export function temporalMetadataAuditErrors(value: unknown): string[] {
  const errors: string[] = [];
  const report = asRecord(value, "temporal metadata audit", errors);
  if (!report) return errors;

  requireExactKeys(
    report,
    [
      "schemaVersion",
      "checkedAt",
      "contract",
      "auditSource",
      "readOnly",
      "atlasVintage",
      "bjornskovRodeCgv",
      "writesPerformedByAudit",
      "semanticSha256",
    ],
    "temporal metadata audit",
    errors,
  );
  if (report.schemaVersion !== TEMPORAL_METADATA_AUDIT_VERSION) {
    errors.push("temporal metadata audit schema version drifted");
  }
  if (report.contract !== TEMPORAL_METADATA_VERSION) {
    errors.push("temporal metadata contract version drifted");
  }
  if (report.auditSource !== TEMPORAL_METADATA_AUDIT_SOURCE) {
    errors.push(
      "temporal metadata audit source is not the read-only production aggregate",
    );
  }
  if (report.readOnly !== true) {
    errors.push("temporal metadata audit must be marked read-only");
  }
  if (!isIsoDate(report.checkedAt)) {
    errors.push(
      "temporal metadata audit checkedAt must be an ISO calendar date",
    );
  }
  if (
    nonNegativeInteger(
      report.writesPerformedByAudit,
      "writesPerformedByAudit",
      errors,
    ) !== 0
  ) {
    errors.push("temporal metadata audit must not perform writes");
  }

  const atlas = asRecord(report.atlasVintage, "atlasVintage", errors);
  if (atlas) {
    requireExactKeys(
      atlas,
      [
        "rows",
        "observationReferenceYearPresent",
        "upstreamDatasetReleasePresent",
        "sourceRetrievedAtPresent",
        "civicaPublicationVersionPresent",
        "publicationVersionMismatches",
        "postCutRetrievalsRetained",
      ],
      "atlasVintage",
      errors,
    );
    const rows = nonNegativeInteger(atlas.rows, "atlasVintage.rows", errors);
    const observation = nonNegativeInteger(
      atlas.observationReferenceYearPresent,
      "atlasVintage.observationReferenceYearPresent",
      errors,
    );
    const upstream = nonNegativeInteger(
      atlas.upstreamDatasetReleasePresent,
      "atlasVintage.upstreamDatasetReleasePresent",
      errors,
    );
    const retrieved = nonNegativeInteger(
      atlas.sourceRetrievedAtPresent,
      "atlasVintage.sourceRetrievedAtPresent",
      errors,
    );
    const publication = nonNegativeInteger(
      atlas.civicaPublicationVersionPresent,
      "atlasVintage.civicaPublicationVersionPresent",
      errors,
    );
    const mismatches = nonNegativeInteger(
      atlas.publicationVersionMismatches,
      "atlasVintage.publicationVersionMismatches",
      errors,
    );
    const postCut = nonNegativeInteger(
      atlas.postCutRetrievalsRetained,
      "atlasVintage.postCutRetrievalsRetained",
      errors,
    );
    if (rows === 0) errors.push("atlasVintage must retain at least one row");
    for (const [label, count] of [
      ["observationReferenceYearPresent", observation],
      ["upstreamDatasetReleasePresent", upstream],
      ["sourceRetrievedAtPresent", retrieved],
      ["civicaPublicationVersionPresent", publication],
    ] as const) {
      if (rows !== null && count !== null && count > rows) {
        errors.push(`atlasVintage.${label} exceeds total rows`);
      }
    }
    if (rows !== null && publication !== null && publication !== rows) {
      errors.push(
        "Atlas publication-version coverage is incomplete in checked evidence",
      );
    }
    if (upstream !== null && retrieved !== null && upstream !== retrieved) {
      errors.push(
        "Atlas upstream-release and retrieval coverage do not remain paired",
      );
    }
    if (mismatches !== null && mismatches !== 0) {
      errors.push(
        "Atlas publication-version mismatches are present in checked evidence",
      );
    }
    if (postCut !== null && postCut !== 0) {
      errors.push("Atlas checked evidence retains post-cut retrievals");
    }
  }

  const regime = asRecord(report.bjornskovRodeCgv, "bjornskovRodeCgv", errors);
  if (regime) {
    requireExactKeys(
      regime,
      [
        "rows",
        "observationReferenceYear",
        "sourceDatasetRelease",
        "distributionRelease",
        "retrievedAt",
        "civicaPublicationVersion",
        "temporalMismatches",
      ],
      "bjornskovRodeCgv",
      errors,
    );
    const rows = nonNegativeInteger(
      regime.rows,
      "bjornskovRodeCgv.rows",
      errors,
    );
    if (rows === 0)
      errors.push("bjornskovRodeCgv must retain at least one row");
    if (
      regime.observationReferenceYear !==
      BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR
    ) {
      errors.push(
        `BR/CGV observation reference year must remain ${BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR}`,
      );
    }
    if (
      regime.sourceDatasetRelease !== BJORNKSKOV_RODE_SOURCE_DATASET_VERSION
    ) {
      errors.push("BR/CGV source dataset release drifted");
    }
    if (regime.distributionRelease !== BJORNKSKOV_RODE_DATASET_VERSION) {
      errors.push("BR/CGV distribution release drifted");
    }
    if (!isIsoTimestamp(regime.retrievedAt)) {
      errors.push("BR/CGV retrieval time is invalid");
    }
    if (regime.civicaPublicationVersion !== DAT_025_BRCGV_PUBLICATION_VERSION) {
      errors.push("BR/CGV Civica publication version drifted");
    }
    const mismatches = nonNegativeInteger(
      regime.temporalMismatches,
      "bjornskovRodeCgv.temporalMismatches",
      errors,
    );
    if (mismatches !== null && mismatches !== 0) {
      errors.push("BR/CGV temporal mismatches are present in checked evidence");
    }
  }

  if (
    typeof report.semanticSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(report.semanticSha256)
  ) {
    errors.push("temporal metadata audit semantic hash is invalid");
  } else if (
    report.semanticSha256 !==
    temporalMetadataAuditSemanticSha256(withoutSemanticHash(report))
  ) {
    errors.push("temporal metadata audit semantic hash drifted");
  }

  return errors;
}
