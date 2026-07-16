import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ATLAS_EXPORT_REGENERATION_INPUTS_SCHEMA_VERSION,
  ATLAS_EXPORT_RELEASE_ID,
  ATLAS_EXPORT_VINTAGE_LABEL,
  atlasLegacyFactRowSha256,
  buildAtlasExport,
  buildAtlasReleaseBom,
  frozenSnapshotExportFact,
  loadAtlasReleaseRegenerationInputs,
  parseAtlasReleaseRegenerationInputs,
  serializeAtlasExport,
} from "./atlas-release";
import { candidateContentHash } from "@/lib/factbook/reconcile/candidate-vintage";
import type { FactRow } from "@/lib/factbook/reconcile/types";

const jurisdiction = { id: "j1", slug: "example", name: "Example" };
const fact = (source_id: string, id = "f1") => ({ id, canonical_fact_id: `canonical-${id}`, jurisdiction_id: "j1", fact_key: "population", source_id, value_status: "observed", fact_value_numeric: 0, vintage_label: ATLAS_EXPORT_VINTAGE_LABEL, civica_publication_version: ATLAS_EXPORT_VINTAGE_LABEL, methodology_version: "v0.2-beta", content_hash: "a".repeat(64), cut_at_timestamp: "2026-05-05T22:54:22.775Z" });

test("export ordering and serialization are deterministic", () => {
  const a = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("wikidata", "z"), fact("cia_factbook", "a")] });
  const b = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("cia_factbook", "a"), fact("wikidata", "z")] });
  assert.equal(serializeAtlasExport(a), serializeAtlasExport(b));
  assert.deepEqual(a.tables.sources.map((row) => row.sourceId), ["cia_factbook", "wikidata"]);
});

test("a pending source fails closed", () => {
  assert.throws(() => buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("vdem")] }), /blocked sources: vdem/);
});

test("a fact for a missing jurisdiction fails closed", () => {
  assert.throws(
    () => buildAtlasExport({
      jurisdictions: [jurisdiction],
      facts: [{ ...fact("wikidata"), jurisdiction_id: "missing-jurisdiction" }],
    }),
    /facts for missing jurisdictions: missing-jurisdiction/,
  );
});

test("zero remains an observed exported value", () => {
  const release = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("world_bank")] });
  assert.equal(release.tables.facts[0].fact_value_numeric, 0);
  assert.equal(release.tables.facts[0].value_status, "observed");
});

test("release BOM is deterministic and complete", () => {
  const release = buildAtlasExport({ jurisdictions: [jurisdiction], facts: [fact("wikidata")] });
  const serialized = serializeAtlasExport(release);
  const input = { release, serialized, compressed: new TextEncoder().encode(serialized), codeCommit: "a".repeat(40), tools: { node: "v1", next: "1", drizzleOrm: "1", typescript: "1", tsx: "1" } };
  const first = buildAtlasReleaseBom(input);
  const second = buildAtlasReleaseBom(input);
  assert.deepEqual(first, second);
  assert.equal(first.files[0].semanticSha256.length, 64);
  assert.equal(first.sourceInputs[0].rowCount, 1);
  assert.equal(first.exportSourceCommit, "a".repeat(40));
});

test("the release loader selects frozen values, source, hash, and method instead of live values", () => {
  const source = readFileSync(new URL("./atlas-release.ts", import.meta.url), "utf8");
  assert.match(source, /FROM country_fact_vintages v/);
  assert.match(source, /LEFT JOIN country_fact_vintage_candidates c/);
  assert.match(source, /v\.value_text AS snapshot_value_text/);
  assert.match(source, /v\.source_id AS snapshot_source_id/);
  assert.match(source, /v\.content_hash/);
  assert.match(source, /v\.methodology_version/);
  assert.doesNotMatch(source, /\b(?:FROM|JOIN)\s+country_facts\b/);
  assert.doesNotMatch(source, /\bFROM\s+jurisdictions\b/);
});

test("a post-cut source-row change cannot replace frozen citation fields", () => {
  const metadata = {
    factGroup: "B" as const,
    category: "people",
    sourceUrl: null,
    valueStatus: "observed" as const,
    valueStatusReason: null,
    valueType: "measured" as const,
    growthMethodology: null,
    publicRowSha256: "",
  };
  const row = {
    snapshot_id: "v1", canonical_fact_id: "cf1", jurisdiction_id: "j1", fact_key: "population",
    snapshot_source_id: "world_bank", snapshot_value_text: "100", snapshot_value_numeric: 100,
    snapshot_value_unit: "people", snapshot_value_json: null, snapshot_as_of: "2024-01-01",
    snapshot_methodology_version: "v0.2-beta", vintage_label: ATLAS_EXPORT_VINTAGE_LABEL,
    civica_publication_version: ATLAS_EXPORT_VINTAGE_LABEL,
    cut_at_timestamp: "2026-05-05T22:54:22.775Z", content_hash: "a".repeat(64),
    candidate_set_status: "canonical_only_legacy",
    current_source_id: "wikidata", current_fact_value: "999", current_fact_value_numeric: 999,
    current_methodology_version: "future-method",
  };
  metadata.publicRowSha256 = atlasLegacyFactRowSha256(row, metadata);
  const exported = frozenSnapshotExportFact(row, metadata);
  assert.equal(exported.source_id, "world_bank");
  assert.equal(exported.fact_value, "100");
  assert.equal(exported.fact_value_numeric, 100);
  assert.equal(exported.methodology_version, "v0.2-beta");
  assert.equal(exported.content_hash, "a".repeat(64));
});

test("the checked Q1 regeneration sidecar is release-bound and complete", () => {
  const inputs = loadAtlasReleaseRegenerationInputs();
  assert.equal(inputs.schemaVersion, ATLAS_EXPORT_REGENERATION_INPUTS_SCHEMA_VERSION);
  assert.equal(inputs.releaseId, ATLAS_EXPORT_RELEASE_ID);
  assert.equal(inputs.vintageLabel, ATLAS_EXPORT_VINTAGE_LABEL);
  assert.equal(inputs.jurisdictions.length, 253);
  assert.equal(Object.keys(inputs.factMetadataBySnapshotId).length, 12_373);
});

test("legacy metadata cross-check rejects any post-cut value drift", () => {
  const row = {
    snapshot_id: "v1",
    canonical_fact_id: "cf1",
    jurisdiction_id: "j1",
    fact_key: "population",
    snapshot_source_id: "world_bank",
    snapshot_value_text: "100",
    snapshot_value_numeric: 100,
    snapshot_value_unit: "people",
    snapshot_value_json: null,
    snapshot_as_of: "2024-01-01",
    observation_reference_year: 2024,
    upstream_dataset_release: "2024",
    source_retrieved_at: "2026-05-01 00:00:00",
    civica_publication_version: ATLAS_EXPORT_VINTAGE_LABEL,
    snapshot_methodology_version: "v0.2-beta",
    vintage_label: ATLAS_EXPORT_VINTAGE_LABEL,
    cut_at_timestamp: "2026-05-05 22:54:22.775",
    content_hash: "a".repeat(64),
    is_disputed_at_cut: false,
    supersedes_vintage_label: null,
    candidate_set_status: "canonical_only_legacy",
  };
  const metadata = {
    factGroup: "B" as const,
    category: "people",
    sourceUrl: "https://publisher.example/population",
    valueStatus: "observed" as const,
    valueStatusReason: null,
    valueType: "measured" as const,
    growthMethodology: null,
    publicRowSha256: "",
  };
  metadata.publicRowSha256 = atlasLegacyFactRowSha256(row, metadata);
  const expected = frozenSnapshotExportFact(row, metadata);
  assert.deepEqual(frozenSnapshotExportFact(row, metadata), expected);
  assert.throws(
    () => frozenSnapshotExportFact({ ...row, snapshot_value_numeric: 101 }, metadata),
    /differs from its checked release metadata/,
  );
});

function completeCandidatePayload(): FactRow {
  return {
    id: "source-row-1",
    jurisdictionId: "j1",
    factKey: "population",
    factGroup: "B",
    category: "people",
    sourceId: "world_bank",
    sourceUrl: "https://publisher.example/population",
    wikidataQid: null,
    wikidataPid: null,
    wikidataRank: null,
    references: [{ retained: true }],
    factValue: "100",
    factValueNumeric: 100,
    factUnit: "people",
    factYear: 2024,
    valueJson: { retained: true },
    valueStatus: "observed",
    valueStatusReason: null,
    asOf: "2024-01-01",
    dataVintageYear: 2024,
    retrievedAt: "2026-06-30T00:00:00.000Z",
    upstreamVintageLabel: "2024",
    methodologyVersion: "source-method/v1",
    status: "active",
    statusReason: null,
    sourceNote: "retained payload",
    valueType: "measured",
    growthMethodology: null,
  };
}

test("complete-candidate export facts retain payload, candidate, evidence, and derivation identities", () => {
  const candidate = completeCandidatePayload();
  const exported = frozenSnapshotExportFact({
    snapshot_id: "vintage-row-1",
    canonical_fact_id: candidate.id,
    canonical_candidate_id: "candidate-row-1",
    jurisdiction_id: candidate.jurisdictionId,
    fact_key: candidate.factKey,
    snapshot_source_id: candidate.sourceId,
    snapshot_value_text: candidate.factValue,
    snapshot_value_numeric: candidate.factValueNumeric,
    snapshot_value_unit: candidate.factUnit,
    snapshot_value_json: candidate.valueJson,
    snapshot_as_of: candidate.asOf,
    observation_reference_year: candidate.dataVintageYear,
    upstream_dataset_release: candidate.upstreamVintageLabel,
    source_retrieved_at: candidate.retrievedAt,
    civica_publication_version: "Civica Atlas Reconciled v0.3-beta — vintage 2026-Q2",
    snapshot_methodology_version: "v0.3-beta",
    derivation_version_key: "derivation-version/sha256:" + "b".repeat(64),
    derivation_versions: { schemaVersion: "derivation-version/v1" },
    vintage_label: "Civica Atlas Reconciled v0.3-beta — vintage 2026-Q2",
    cut_at_timestamp: "2026-07-01T00:00:00.000Z",
    content_hash: "a".repeat(64),
    is_disputed_at_cut: false,
    supersedes_vintage_label: null,
    candidate_set_status: "complete_candidates",
    candidate_source_row_id: candidate.id,
    candidate_content_hash: candidateContentHash(candidate),
    candidate_input_evidence_kind: "normalized_observation_hash",
    candidate_input_evidence_hash: "d".repeat(64),
    candidate_adapter_version_hash: "e".repeat(64),
    candidate_payload: candidate,
  });
  assert.equal(exported.fact_group, candidate.factGroup);
  assert.equal(exported.source_url, candidate.sourceUrl);
  assert.equal(exported.canonical_candidate_id, "candidate-row-1");
  assert.equal(exported.candidate_source_row_id, candidate.id);
  assert.equal(exported.candidate_content_hash, candidateContentHash(candidate));
  assert.equal(exported.candidate_input_evidence_hash, "d".repeat(64));
  assert.equal(exported.derivation_version_key, "derivation-version/sha256:" + "b".repeat(64));
  assert.deepEqual(exported.derivation_versions, { schemaVersion: "derivation-version/v1" });
});

test("canonical-only legacy facts cannot fall back to caller or current-row metadata", () => {
  assert.throws(
    () => frozenSnapshotExportFact({
      snapshot_id: "legacy-row",
      candidate_set_status: "canonical_only_legacy",
      fact_group: "A",
      category: "mutable-current-category",
    }),
    /lacks checked frozen metadata/,
  );
  assert.throws(
    () => frozenSnapshotExportFact({
      snapshot_id: "staging-row",
      candidate_set_status: "staging",
    }),
    /unpublished or unknown release status/,
  );
});

test("regeneration sidecar parsing fails closed on duplicate jurisdiction identity", () => {
  assert.throws(
    () => parseAtlasReleaseRegenerationInputs({
      schemaVersion: ATLAS_EXPORT_REGENERATION_INPUTS_SCHEMA_VERSION,
      releaseId: ATLAS_EXPORT_RELEASE_ID,
      vintageLabel: ATLAS_EXPORT_VINTAGE_LABEL,
      sourceArtifactFileSha256: "a".repeat(64),
      jurisdictions: [{ id: "j1" }, { id: "j1" }],
      factMetadataBySnapshotId: {
        v1: {
          factGroup: "B",
          category: "people",
          sourceUrl: null,
          valueStatus: "observed",
          valueStatusReason: null,
          valueType: "measured",
          growthMethodology: null,
          publicRowSha256: "b".repeat(64),
        },
      },
    }),
    /duplicate jurisdiction ids/,
  );
});
