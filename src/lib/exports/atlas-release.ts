import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SOURCE_RIGHTS } from "@/lib/rights/manifest";
import { parseAtlasVintageLabel } from "@/lib/data/frozen-vintage";
import { DATA_VALUE_STATUSES, type DataValueStatus } from "@/lib/data/value-state";
import { candidateContentHash } from "@/lib/factbook/reconcile/candidate-vintage";
import type { FactRow } from "@/lib/factbook/reconcile/types";

export const ATLAS_EXPORT_SCHEMA_VERSION = "civica-atlas-export/v3" as const;
export const ATLAS_EXPORT_RELEASE_ID = "atlas-2026-07-11" as const;
export const ATLAS_EXPORT_RELEASE_DATE = "2026-07-11" as const;
export const ATLAS_EXPORT_VINTAGE_LABEL = "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1" as const;
export const ATLAS_EXPORT_REGENERATION_INPUTS_SCHEMA_VERSION = "atlas-release-regeneration-inputs/v1" as const;

const ATLAS_EXPORT_ARTIFACT_PATH = resolve(
  "data/releases",
  ATLAS_EXPORT_RELEASE_ID,
  "atlas-export.v1.json.gz",
);
const ATLAS_EXPORT_REGENERATION_INPUTS_PATH = resolve(
  "data/releases",
  ATLAS_EXPORT_RELEASE_ID,
  "regeneration-inputs.v1.json.gz",
);

export const ATLAS_EXPORT_ALLOWED_SOURCE_IDS = SOURCE_RIGHTS.filter(
  (row) => row.reviewStatus === "verified" && row.publicExport === "allowed",
)
  .map((row) => row.sourceId)
  .sort();

export interface AtlasExportInput {
  jurisdictions: Record<string, unknown>[];
  facts: Record<string, unknown>[];
}

export interface AtlasLegacyFactMetadata {
  factGroup: FactRow["factGroup"];
  category: string;
  sourceUrl: string | null;
  valueStatus: DataValueStatus;
  valueStatusReason: string | null;
  valueType: FactRow["valueType"];
  growthMethodology: FactRow["growthMethodology"];
  publicRowSha256: string;
}

export interface AtlasReleaseRegenerationInputs {
  schemaVersion: typeof ATLAS_EXPORT_REGENERATION_INPUTS_SCHEMA_VERSION;
  releaseId: typeof ATLAS_EXPORT_RELEASE_ID;
  vintageLabel: typeof ATLAS_EXPORT_VINTAGE_LABEL;
  sourceArtifactFileSha256: string;
  jurisdictions: Record<string, unknown>[];
  factMetadataBySnapshotId: Record<string, AtlasLegacyFactMetadata>;
}

export function buildAtlasExport(input: AtlasExportInput) {
  const jurisdictions = [...input.jurisdictions].sort((a, b) =>
    String(a.slug).localeCompare(String(b.slug)),
  );
  const facts = [...input.facts].sort((a, b) =>
    [a.jurisdiction_id, a.fact_key, a.source_id, a.id]
      .map(String)
      .join("\u0000")
      .localeCompare(
        [b.jurisdiction_id, b.fact_key, b.source_id, b.id]
          .map(String)
          .join("\u0000"),
      ),
  );
  const usedSourceIds = [
    ...new Set(facts.map((row) => String(row.source_id))),
  ].sort();
  const identity = parseAtlasVintageLabel(ATLAS_EXPORT_VINTAGE_LABEL);
  const invalidVintageRows = facts.filter((row) =>
    row.vintage_label !== ATLAS_EXPORT_VINTAGE_LABEL ||
    row.civica_publication_version !== ATLAS_EXPORT_VINTAGE_LABEL ||
    row.methodology_version !== identity.methodologyVersion ||
    typeof row.content_hash !== "string" || !/^[a-f0-9]{64}$/.test(row.content_hash),
  );
  if (invalidVintageRows.length) {
    throw new Error(`Atlas export contains ${invalidVintageRows.length} row(s) outside the frozen vintage/version/hash contract.`);
  }
  const cutTimes = [...new Set(facts.map((row) => String(row.cut_at_timestamp)))];
  if (cutTimes.length !== 1 || cutTimes[0] === "null" || cutTimes[0] === "undefined") {
    throw new Error(`Atlas export requires one frozen cutoff; found ${cutTimes.join(", ") || "none"}.`);
  }
  const jurisdictionIds = new Set(jurisdictions.map((row) => String(row.id)));
  const orphanJurisdictionIds = [
    ...new Set(
      facts
        .map((row) => String(row.jurisdiction_id))
        .filter((id) => !jurisdictionIds.has(id)),
    ),
  ].sort();
  if (orphanJurisdictionIds.length) {
    throw new Error(
      `Atlas export contains facts for missing jurisdictions: ${orphanJurisdictionIds.join(", ")}`,
    );
  }
  const blocked = usedSourceIds.filter(
    (sourceId) => !ATLAS_EXPORT_ALLOWED_SOURCE_IDS.includes(sourceId),
  );
  if (blocked.length) {
    throw new Error(`Atlas export contains blocked sources: ${blocked.join(", ")}`);
  }
  const sources = SOURCE_RIGHTS.filter((row) =>
    usedSourceIds.includes(row.sourceId),
  ).sort((a, b) => a.sourceId.localeCompare(b.sourceId));

  return {
    schemaVersion: ATLAS_EXPORT_SCHEMA_VERSION,
    releaseId: ATLAS_EXPORT_RELEASE_ID,
    releaseDate: ATLAS_EXPORT_RELEASE_DATE,
    vintageLabel: ATLAS_EXPORT_VINTAGE_LABEL,
    cutoffAt: cutTimes[0],
    generatedAt: `${ATLAS_EXPORT_RELEASE_DATE}T00:00:00.000Z`,
    scope:
      "Frozen canonical Atlas reference records from the named Q1 snapshot only. Civica Index, Pulse, alternates, restricted source rows, images, and publisher payloads are excluded.",
    rightsManifest: "/api/rights-manifest",
    tables: { jurisdictions, facts, sources },
    codebook: {
      jurisdictions:
        "Stable Civica jurisdiction identity and sourced status classification.",
      facts:
        "As-published canonical selections copied from the immutable named vintage; current post-cut values and alternate observations are excluded.",
      sources:
        "Source-specific license, terms, attribution, and restriction records for every emitted fact row.",
      joins: {
        "facts.jurisdiction_id": "jurisdictions.id",
        "facts.source_id": "sources.sourceId",
      },
      ordering: {
        jurisdictions: "slug ascending",
        facts: "jurisdiction_id, fact_key, source_id, id ascending",
        sources: "sourceId ascending",
      },
      columns: {
        jurisdictions: {
          id: "Stable Civica UUID.", slug: "Stable URL identifier.", name: "Display name.", type: "Closed jurisdiction-status/v1 class.",
          iso2: "ISO alpha-2 code when assigned.", iso3: "ISO alpha-3 code when assigned.", wikidata_qid: "Wikidata entity identifier when linked.",
          status_source_ids: "Source registry keys supporting the status classification.", status_reviewed_at: "Date Civica reviewed the status classification.",
          status_note: "Neutral scope and classification note.", administering_jurisdiction_iso3: "Administering jurisdiction ISO3 where applicable.", status_disputed: "Whether the territorial/status record is disputed.",
        },
        facts: {
          id: "Stable frozen-vintage row UUID.", canonical_fact_id: "Source-observation row selected at the cutoff.", jurisdiction_id: "Foreign key to jurisdictions.id.", fact_key: "Stable Civica fact identifier.", fact_group: "Reconciliation group A, B, or C.", category: "Reader-facing fact category.",
          source_id: "Foreign key to sources.sourceId.", source_url: "Direct upstream record URL when captured.", fact_value: "Source display value.", fact_value_numeric: "Numeric form when available; zero is observed, not missing.", fact_unit: "Unit attached to the value.", value_json: "Structured value when scalar columns are insufficient.",
          value_status: "Closed data-value-state/v1 status.", value_status_reason: "Required explanation for non-observed states.", as_of: "Upstream observation/reference date.", observation_reference_year: "Year the observation describes; never an ingestion or release year.", upstream_dataset_release: "Publisher/distributor dataset edition, distinct from observation year.", source_retrieved_at: "When Civica retrieved the selected source row, when retained at or before the cut.", civica_publication_version: "Civica's named publication handle.", methodology_version: "Published Civica method version.", value_type: "Measured or projected source value.", growth_methodology: "Growth-rate basis where applicable.", vintage_label: "Immutable Civica citation handle.", cut_at_timestamp: "Shared Civica publication cutoff for the vintage.", content_hash: "SHA-256 of the frozen value, source, date, and method recipe.", is_disputed_at_cut: "Whether the canonical selection was disputed when frozen.", supersedes_vintage_label: "Earlier release replaced by this version, when applicable.",
        },
        sources: {
          sourceId: "Stable source identifier.", licenseId: "Source license or legal designation.", termsUrl: "Publisher terms URL.", reviewStatus: "Civica rights-review status.", reviewedAt: "Rights review date.", publicExport: "Bulk-export permission decision.", commercialUse: "Whether source terms allow commercial use.", derivatives: "Whether source terms allow derivatives.", attributionRequired: "Whether source terms require attribution.", shareAlikeRequired: "Whether share-alike applies.", restrictions: "Source-specific cautions and conditions.",
        },
      },
    },
    counts: {
      jurisdictions: jurisdictions.length,
      facts: facts.length,
      sources: sources.length,
    },
  };
}

export function serializeAtlasExport(value: ReturnType<typeof buildAtlasExport>) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function atlasExportSha256(serialized: string) {
  return createHash("sha256").update(serialized).digest("hex");
}

export function buildAtlasReleaseBom(input: {
  release: ReturnType<typeof buildAtlasExport>;
  serialized: string;
  compressed: Uint8Array;
  codeCommit: string;
  tools: Record<string, string>;
}) {
  const { release, serialized, compressed } = input;
  const sourceInputs = release.tables.sources.map((source) => {
    const rows = release.tables.facts.filter(
      (fact) => fact.source_id === source.sourceId,
    );
    const labels = [...new Set(rows.map((row) => row.upstream_dataset_release).filter(Boolean).map(String))].sort();
    const years = rows.map((row) => row.observation_reference_year).filter((value): value is number => typeof value === "number");
    const retrieved = rows.map((row) => row.source_retrieved_at).filter(Boolean).map(String).sort();
    return {
      sourceId: source.sourceId,
      rowCount: rows.length,
      upstreamVintageLabels: labels,
      observationYearMin: years.length ? Math.min(...years) : null,
      observationYearMax: years.length ? Math.max(...years) : null,
      retrievedThrough: retrieved.at(-1) ?? null,
      semanticSha256: createHash("sha256")
        .update(JSON.stringify(rows))
        .digest("hex"),
    };
  });
  return {
    schemaVersion: "civica-release-bom/v1",
    releaseId: release.releaseId,
    releaseDate: release.releaseDate,
    exportSourceCommit: input.codeCommit,
    schemas: {
      export: release.schemaVersion,
      rights: "rights-manifest/v1",
      jurisdictionStatus: "jurisdiction-status/v1",
      dataValueState: "data-value-state/v1",
    },
    tools: Object.fromEntries(Object.entries(input.tools).sort(([a], [b]) => a.localeCompare(b))),
    files: [
      {
        role: "normalized-export",
        path: "atlas-export.v1.json.gz",
        encoding: "gzip",
        semanticSha256: atlasExportSha256(serialized),
        uncompressedByteLength: Buffer.byteLength(serialized),
        fileSha256: createHash("sha256").update(compressed).digest("hex"),
        fileByteLength: compressed.byteLength,
      },
    ],
    rowCounts: release.counts,
    sourceInputs,
    publicDownload: `/downloads/civica-${release.releaseId}.json.gz`,
  };
}

function resultRows(result: unknown): Record<string, unknown>[] {
  return (Array.isArray(result)
    ? result
    : ((result as { rows?: Record<string, unknown>[] }).rows ?? [])) as Record<
    string,
    unknown
  >[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const SHA256 = /^[a-f0-9]{64}$/;

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isLegacyFactMetadata(value: unknown): value is AtlasLegacyFactMetadata {
  if (!isRecord(value)) return false;
  return (
    (value.factGroup === "A" || value.factGroup === "B" || value.factGroup === "C") &&
    typeof value.category === "string" &&
    value.category.length > 0 &&
    isNullableString(value.sourceUrl) &&
    DATA_VALUE_STATUSES.includes(value.valueStatus as DataValueStatus) &&
    isNullableString(value.valueStatusReason) &&
    (value.valueType === "measured" || value.valueType === "projected") &&
    (value.growthMethodology === null ||
      value.growthMethodology === "annual_yoy" ||
      value.growthMethodology === "four_quarter_accumulated_yoy" ||
      value.growthMethodology === "qoq_seasonally_adjusted" ||
      value.growthMethodology === "annualized_qoq" ||
      value.growthMethodology === "unspecified") &&
    typeof value.publicRowSha256 === "string" &&
    SHA256.test(value.publicRowSha256)
  );
}

export function atlasExportFactRowSha256(row: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(row)).digest("hex");
}

export function parseAtlasReleaseRegenerationInputs(
  value: unknown,
): AtlasReleaseRegenerationInputs {
  if (!isRecord(value)) throw new Error("Atlas release regeneration inputs must be an object");
  if (value.schemaVersion !== ATLAS_EXPORT_REGENERATION_INPUTS_SCHEMA_VERSION) {
    throw new Error("Atlas release regeneration input schema drift");
  }
  if (value.releaseId !== ATLAS_EXPORT_RELEASE_ID || value.vintageLabel !== ATLAS_EXPORT_VINTAGE_LABEL) {
    throw new Error("Atlas release regeneration inputs do not match the frozen release identity");
  }
  if (typeof value.sourceArtifactFileSha256 !== "string" || !SHA256.test(value.sourceArtifactFileSha256)) {
    throw new Error("Atlas release regeneration inputs lack a valid source artifact hash");
  }
  if (!Array.isArray(value.jurisdictions) || value.jurisdictions.length === 0 || !value.jurisdictions.every(isRecord)) {
    throw new Error("Atlas release regeneration inputs lack frozen jurisdiction rows");
  }
  const jurisdictionIds = value.jurisdictions.map((row) => row.id);
  if (
    jurisdictionIds.some((id) => typeof id !== "string" || !id) ||
    new Set(jurisdictionIds).size !== jurisdictionIds.length
  ) {
    throw new Error("Atlas release regeneration inputs contain invalid or duplicate jurisdiction ids");
  }
  if (!isRecord(value.factMetadataBySnapshotId) || Object.keys(value.factMetadataBySnapshotId).length === 0) {
    throw new Error("Atlas release regeneration inputs lack frozen fact metadata");
  }
  for (const [snapshotId, metadata] of Object.entries(value.factMetadataBySnapshotId)) {
    if (!snapshotId || !isLegacyFactMetadata(metadata)) {
      throw new Error(`Atlas release regeneration metadata is invalid for snapshot ${snapshotId || "<missing>"}`);
    }
  }
  return value as unknown as AtlasReleaseRegenerationInputs;
}

export function loadAtlasReleaseRegenerationInputs(): AtlasReleaseRegenerationInputs {
  const sourceArtifact = readFileSync(ATLAS_EXPORT_ARTIFACT_PATH);
  const inputs = parseAtlasReleaseRegenerationInputs(
    JSON.parse(gunzipSync(readFileSync(ATLAS_EXPORT_REGENERATION_INPUTS_PATH)).toString("utf8")),
  );
  const sourceArtifactFileSha256 = createHash("sha256").update(sourceArtifact).digest("hex");
  if (sourceArtifactFileSha256 !== inputs.sourceArtifactFileSha256) {
    throw new Error("Atlas release regeneration inputs were not derived from the checked immutable artifact");
  }
  return inputs;
}

function retainedCandidatePayload(row: Record<string, unknown>): FactRow {
  if (!isRecord(row.candidate_payload)) {
    throw new Error(`Complete candidate release fact ${String(row.snapshot_id)} lacks its retained payload`);
  }
  const payload = row.candidate_payload as unknown as FactRow;
  if (
    typeof row.canonical_candidate_id !== "string" ||
    typeof row.candidate_source_row_id !== "string" ||
    typeof row.candidate_content_hash !== "string" ||
    typeof row.candidate_input_evidence_kind !== "string" ||
    typeof row.candidate_input_evidence_hash !== "string" ||
    typeof row.candidate_adapter_version_hash !== "string" ||
    typeof row.derivation_version_key !== "string" ||
    !isRecord(row.derivation_versions)
  ) {
    throw new Error(`Complete candidate release fact ${String(row.snapshot_id)} lacks retained candidate or derivation identity`);
  }
  if (
    !SHA256.test(row.candidate_content_hash) ||
    !SHA256.test(row.candidate_input_evidence_hash) ||
    !SHA256.test(row.candidate_adapter_version_hash) ||
    (row.candidate_input_evidence_kind !== "source_payload_hash" &&
      row.candidate_input_evidence_kind !== "normalized_observation_hash") ||
    candidateContentHash(payload) !== row.candidate_content_hash
  ) {
    throw new Error(`Complete candidate release fact ${String(row.snapshot_id)} has invalid retained candidate evidence`);
  }
  if (
    payload.id !== row.candidate_source_row_id ||
    payload.id !== row.canonical_fact_id ||
    payload.jurisdictionId !== row.jurisdiction_id ||
    payload.factKey !== row.fact_key ||
    payload.sourceId !== row.snapshot_source_id ||
    payload.factValue !== row.snapshot_value_text ||
    payload.factValueNumeric !== row.snapshot_value_numeric ||
    payload.factUnit !== row.snapshot_value_unit ||
    payload.asOf !== row.snapshot_as_of ||
    JSON.stringify(payload.valueJson) !== JSON.stringify(row.snapshot_value_json)
  ) {
    throw new Error(`Complete candidate release fact ${String(row.snapshot_id)} disagrees with its retained payload`);
  }
  return payload;
}

/**
 * Maps immutable vintage/candidate rows to the public release row. The Q1
 * canonical-only legacy release uses a checked metadata sidecar for fields its
 * vintage schema did not retain. Its existing canonical_fact_id and
 * content_hash are the disclosed legacy candidate/derivation identities.
 * Complete-candidate releases additionally emit their retained candidate and
 * derivation-version identities.
 */
function frozenSnapshotBaseFact(
  row: Record<string, unknown>,
  candidatePayload: FactRow | null,
  metadata: Omit<AtlasLegacyFactMetadata, "publicRowSha256"> | undefined,
): Record<string, unknown> {
  if (!candidatePayload && !metadata) {
    throw new Error(`Canonical-only legacy Atlas fact ${String(row.snapshot_id)} lacks checked frozen metadata`);
  }
  return {
    id: row.snapshot_id,
    canonical_fact_id: row.canonical_fact_id,
    jurisdiction_id: row.jurisdiction_id,
    fact_key: row.fact_key,
    fact_group: candidatePayload ? candidatePayload.factGroup : metadata!.factGroup,
    category: candidatePayload ? candidatePayload.category : metadata!.category,
    source_id: row.snapshot_source_id,
    source_url: candidatePayload ? candidatePayload.sourceUrl : metadata!.sourceUrl,
    fact_value: row.snapshot_value_text,
    fact_value_numeric: row.snapshot_value_numeric,
    fact_unit: row.snapshot_value_unit,
    value_json: row.snapshot_value_json,
    value_status: candidatePayload ? candidatePayload.valueStatus : metadata!.valueStatus,
    value_status_reason: candidatePayload ? candidatePayload.valueStatusReason : metadata!.valueStatusReason,
    as_of: row.snapshot_as_of,
    observation_reference_year: row.observation_reference_year,
    upstream_dataset_release: row.upstream_dataset_release,
    source_retrieved_at: row.source_retrieved_at,
    civica_publication_version: row.civica_publication_version,
    methodology_version: row.snapshot_methodology_version,
    value_type: candidatePayload ? candidatePayload.valueType : metadata!.valueType,
    growth_methodology: candidatePayload ? candidatePayload.growthMethodology : metadata!.growthMethodology,
    vintage_label: row.vintage_label,
    cut_at_timestamp: row.cut_at_timestamp,
    content_hash: row.content_hash,
    is_disputed_at_cut: row.is_disputed_at_cut,
    supersedes_vintage_label: row.supersedes_vintage_label,
  };
}

/** Test/generation seam for binding a legacy metadata row to its full public row. */
export function atlasLegacyFactRowSha256(
  row: Record<string, unknown>,
  metadata: Omit<AtlasLegacyFactMetadata, "publicRowSha256">,
): string {
  return atlasExportFactRowSha256(frozenSnapshotBaseFact(row, null, metadata));
}

export function frozenSnapshotExportFact(
  row: Record<string, unknown>,
  legacyMetadata?: AtlasLegacyFactMetadata,
): Record<string, unknown> {
  const isCompleteCandidateRelease = row.candidate_set_status === "complete_candidates";
  const isLegacyRelease = row.candidate_set_status === "canonical_only_legacy";
  if (!isCompleteCandidateRelease && !isLegacyRelease) {
    throw new Error(`Frozen Atlas fact ${String(row.snapshot_id)} has an unpublished or unknown release status`);
  }
  if (isLegacyRelease && !legacyMetadata) {
    throw new Error(`Canonical-only legacy Atlas fact ${String(row.snapshot_id)} lacks checked frozen metadata`);
  }
  const candidatePayload = isCompleteCandidateRelease ? retainedCandidatePayload(row) : null;
  const metadata = legacyMetadata;
  const fact = frozenSnapshotBaseFact(row, candidatePayload, metadata);
  if (!isCompleteCandidateRelease) {
    if (atlasExportFactRowSha256(fact) !== metadata!.publicRowSha256) {
      throw new Error(`Frozen Atlas fact ${String(row.snapshot_id)} differs from its checked release metadata`);
    }
    return fact;
  }
  return {
    ...fact,
    candidate_set_status: "complete_candidates",
    canonical_candidate_id: row.canonical_candidate_id,
    candidate_source_row_id: row.candidate_source_row_id,
    candidate_content_hash: row.candidate_content_hash,
    candidate_input_evidence_kind: row.candidate_input_evidence_kind,
    candidate_input_evidence_hash: row.candidate_input_evidence_hash,
    candidate_adapter_version_hash: row.candidate_adapter_version_hash,
    derivation_version_key: row.derivation_version_key,
    derivation_versions: row.derivation_versions,
  };
}

export async function loadAtlasExportInput(): Promise<AtlasExportInput> {
  const allowed = ATLAS_EXPORT_ALLOWED_SOURCE_IDS;
  const regenerationInputs = loadAtlasReleaseRegenerationInputs();
  const factResult = await db.execute(sql`
      SELECT v.id AS snapshot_id, v.canonical_fact_id, v.canonical_candidate_id,
             v.jurisdiction_id, v.fact_key, v.source_id AS snapshot_source_id,
             v.value_text AS snapshot_value_text,
             v.value_numeric AS snapshot_value_numeric,
             v.value_unit AS snapshot_value_unit,
             v.value_json AS snapshot_value_json,
             v.as_of AS snapshot_as_of,
             v.observation_reference_year, v.upstream_dataset_release,
             v.source_retrieved_at, v.civica_publication_version,
             v.methodology_version AS snapshot_methodology_version,
             v.derivation_version_key, v.derivation_versions,
             v.vintage_label, v.cut_at_timestamp, v.content_hash,
             v.is_disputed_at_cut, v.supersedes_vintage_label,
             r.completeness_status AS candidate_set_status,
             r.cut_at_timestamp AS release_cut_at_timestamp,
             r.methodology_version AS release_methodology_version,
             r.candidate_count AS release_candidate_count,
             r.candidate_set_checksum AS release_candidate_set_checksum,
             c.source_row_id AS candidate_source_row_id,
             c.candidate_content_hash,
             c.input_evidence_kind AS candidate_input_evidence_kind,
             c.input_evidence_hash AS candidate_input_evidence_hash,
             c.adapter_version_hash AS candidate_adapter_version_hash,
             c.candidate_payload
      FROM country_fact_vintages v
      JOIN country_fact_vintage_releases r
        ON r.vintage_label = v.vintage_label
      LEFT JOIN country_fact_vintage_candidates c
        ON c.id = v.canonical_candidate_id
       AND c.vintage_label = v.vintage_label
      WHERE v.vintage_label = ${ATLAS_EXPORT_VINTAGE_LABEL}
        AND v.source_id IN ${allowed}
      ORDER BY v.jurisdiction_id, v.fact_key, v.source_id, v.id
    `);
  const seenSnapshotIds = new Set<string>();
  const facts = resultRows(factResult).map((row) => {
    const snapshotId = String(row.snapshot_id);
    if (seenSnapshotIds.has(snapshotId)) {
      throw new Error(`Frozen Atlas release returned duplicate snapshot row ${snapshotId}`);
    }
    seenSnapshotIds.add(snapshotId);
    const metadata = regenerationInputs.factMetadataBySnapshotId[snapshotId];
    if (row.candidate_set_status !== "canonical_only_legacy") {
      throw new Error("The checked Q1 Atlas export must remain explicitly canonical_only_legacy");
    }
    if (
      row.canonical_candidate_id != null ||
      row.release_candidate_count != null ||
      row.release_candidate_set_checksum != null
    ) {
      throw new Error("The checked Q1 Atlas export cannot claim retained candidate evidence");
    }
    if (
      row.vintage_label !== ATLAS_EXPORT_VINTAGE_LABEL ||
      row.civica_publication_version !== ATLAS_EXPORT_VINTAGE_LABEL ||
      row.snapshot_methodology_version !== row.release_methodology_version ||
      String(row.cut_at_timestamp) !== String(row.release_cut_at_timestamp)
    ) {
      throw new Error(`Frozen Atlas release identity differs for snapshot row ${snapshotId}`);
    }
    if (!metadata) {
      throw new Error(`Frozen Atlas release lacks checked metadata for snapshot row ${snapshotId}`);
    }
    return frozenSnapshotExportFact(row, metadata);
  });
  const missingSnapshotIds = Object.keys(regenerationInputs.factMetadataBySnapshotId)
    .filter((snapshotId) => !seenSnapshotIds.has(snapshotId));
  if (missingSnapshotIds.length) {
    throw new Error(`Frozen Atlas release is missing ${missingSnapshotIds.length} checked snapshot row(s)`);
  }
  return {
    jurisdictions: regenerationInputs.jurisdictions,
    facts,
  };
}
