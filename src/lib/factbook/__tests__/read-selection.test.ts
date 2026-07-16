import assert from "node:assert/strict";
import test from "node:test";
import {
  frozenResolutionsFromRows,
  metadataFromResolutions,
  parseAtlasReadSelection,
  validateFrozenReleaseRows,
} from "../read-selection";
import { candidateContentHash } from "../reconcile/candidate-vintage";
import {
  derivationVersionKey,
  legacyDerivationVersionEnvelope,
} from "@/lib/research/derivation-version";
import type { FactRow } from "../reconcile/types";

const vintage = "Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1";

test("selection requires explicit live or complete immutable vintage", () => {
  assert.match(parseAtlasReadSelection(null).error ?? "", /required/);
  assert.deepEqual(parseAtlasReadSelection("live").selection, { mode: "live", asOf: "live" });
  assert.deepEqual(parseAtlasReadSelection(vintage).selection, { mode: "vintage", asOf: vintage });
  assert.match(parseAtlasReadSelection("2026-Q1").error ?? "", /complete/);
});

test("live metadata cannot carry a frozen vintage or cutoff", () => {
  const metadata = metadataFromResolutions({ mode: "live", asOf: "live" }, {});
  assert.equal(metadata.vintage, null);
  assert.equal(metadata.cutoffAt, null);
  assert.equal(metadata.asOf, "live");
  assert.equal(metadata.candidateSetStatus, "live");
});

test("frozen metadata comes from the selected label and row contract", () => {
  assert.deepEqual(metadataFromResolutions({ mode: "vintage", asOf: vintage }, {}, { cutoffAt: "2026-05-05T19:54:22.775Z", retrievedThrough: "2026-04-30T12:00:00.000Z", methodologyVersions: ["v0.2-beta"], candidateSetStatus: "canonical_only_legacy" }), {
    mode: "vintage", asOf: vintage, vintage, cutoffAt: "2026-05-05T19:54:22.775Z", retrievedThrough: "2026-04-30T12:00:00.000Z", methodologyVersions: ["v0.2-beta"], candidateSetStatus: "canonical_only_legacy", candidateSetChecksum: null, winnerSetChecksum: null, resolverVersionHash: null,
  });
  assert.throws(
    () => metadataFromResolutions({ mode: "vintage", asOf: vintage }, {}),
    /metadata is unavailable/,
  );
});

const completeVintage = "Civica Atlas Reconciled v0.3-beta — vintage 2026-Q2";

function retainedCandidate(overrides: Partial<FactRow> = {}): FactRow {
  return {
    id: "source-row-winner",
    jurisdictionId: "jurisdiction-1",
    factKey: "future_definition_not_in_current_registry",
    factGroup: "C",
    category: "retained-category",
    sourceId: "retained-source",
    sourceUrl: "https://publisher.example/retained",
    wikidataQid: null,
    wikidataPid: null,
    wikidataRank: null,
    references: [{ retained: true }],
    factValue: "retained display value",
    factValueNumeric: 42,
    factUnit: "retained units",
    factYear: 2025,
    valueJson: { retained: true },
    valueStatus: "disputed",
    valueStatusReason: null,
    asOf: "2025-12-31",
    dataVintageYear: 2025,
    retrievedAt: "2026-06-30T00:00:00.000Z",
    upstreamVintageLabel: "publisher-2025",
    methodologyVersion: "v0.3-beta",
    status: "active",
    statusReason: "retained status reason",
    sourceNote: "retained note",
    valueType: "projected",
    growthMethodology: "annual_yoy",
    ...overrides,
  };
}

const completeCut = new Date("2026-07-01T00:00:00.000Z");
const testDerivationVersions = legacyDerivationVersionEnvelope("test fixture");

function frozenVintageRow(
  canonical: FactRow,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "vintage-row",
    jurisdictionId: canonical.jurisdictionId,
    factKey: canonical.factKey,
    vintageLabel: completeVintage,
    canonicalFactId: canonical.id,
    canonicalCandidateId: "candidate-winner",
    valueText: canonical.factValue,
    valueNumeric: canonical.factValueNumeric,
    valueUnit: canonical.factUnit,
    valueJson: canonical.valueJson,
    asOf: canonical.asOf,
    observationReferenceYear: canonical.dataVintageYear,
    sourceId: canonical.sourceId,
    sourceRetrievedAt: new Date(canonical.retrievedAt),
    snapshotAt: completeCut,
    upstreamDatasetRelease: canonical.upstreamVintageLabel,
    civicaPublicationVersion: completeVintage,
    methodologyVersion: "v0.3-beta",
    derivationVersionKey: derivationVersionKey(testDerivationVersions),
    derivationVersions: testDerivationVersions,
    cutAtTimestamp: completeCut,
    contentHash: "a".repeat(64),
    isDisputedAtCut: true,
    supersedesVintageLabel: null,
    ...overrides,
  };
}

function frozenCandidateRow(input: {
  id: string;
  candidate: FactRow;
  isCanonicalAtCut: boolean;
  decisionReason?: string | null;
  decisionTrace?: unknown;
}) {
  return {
    id: input.id,
    vintageLabel: completeVintage,
    cutAtTimestamp: completeCut,
    jurisdictionId: input.candidate.jurisdictionId,
    factKey: input.candidate.factKey,
    sourceId: input.candidate.sourceId,
    sourceRowId: input.candidate.id,
    inputEvidenceKind: "normalized_observation_hash",
    inputEvidenceHash: "b".repeat(64),
    adapterVersionHash: "c".repeat(64),
    candidateContentHash: candidateContentHash(input.candidate),
    candidateStatus: input.candidate.status,
    candidatePayload: input.candidate,
    isCanonicalAtCut: input.isCanonicalAtCut,
    decisionReason: input.decisionReason ?? null,
    decisionTrace: input.decisionTrace ?? null,
  } as const;
}

test("canonical-only Q1 reads use checked frozen metadata and disclose that candidates are unavailable", () => {
  const canonical = retainedCandidate({
    id: "legacy-source-row",
    factKey: "legacy_key_absent_from_current_registry",
    factGroup: "A",
    category: "wrong-current-category",
    valueType: "measured",
    growthMethodology: null,
  });
  const q1Cut = new Date("2026-05-05T19:54:22.775Z");
  const row = frozenVintageRow(canonical, {
    id: "legacy-vintage-row",
    vintageLabel: vintage,
    canonicalCandidateId: null,
    civicaPublicationVersion: vintage,
    methodologyVersion: "v0.2-beta",
    derivationVersionKey: "derivation/legacy-unversioned/country_fact_vintages",
    cutAtTimestamp: q1Cut,
    snapshotAt: q1Cut,
  });
  const frozenMetadata = {
    factGroup: "C" as const,
    category: "frozen-release-category",
    sourceUrl: "https://publisher.example/frozen-at-cut",
    valueStatus: "observed" as const,
    valueStatusReason: null,
    valueType: "measured" as const,
    growthMethodology: null,
    publicRowSha256: "d".repeat(64),
  };
  const resolutions = frozenResolutionsFromRows({
    jurisdictionId: canonical.jurisdictionId,
    candidateSetStatus: "canonical_only_legacy",
    vintageRows: [row],
    candidateRows: [],
    legacyMetadataBySnapshotId: { [row.id]: frozenMetadata },
  });
  const result = resolutions[canonical.factKey];
  assert.equal(result.canonical?.id, canonical.id);
  assert.equal(result.canonical?.factGroup, "C");
  assert.equal(result.canonical?.category, "frozen-release-category");
  assert.equal(result.canonical?.sourceUrl, "https://publisher.example/frozen-at-cut");
  assert.equal(result.decisionReason, "canonical_only_legacy");
  assert.equal(result.decisionTrace[0].outcome, "canonical_only_legacy_selection");
  assert.match(result.decisionTrace[0].detail, /not retained and are not reconstructed/);
  assert.throws(
    () => frozenResolutionsFromRows({
      jurisdictionId: canonical.jurisdictionId,
      candidateSetStatus: "canonical_only_legacy",
      vintageRows: [row],
      candidateRows: [],
    }),
    /lacks checked frozen metadata/,
  );
});

test("release and winner rows must share one frozen label, method, cutoff, and publication identity", () => {
  const canonical = retainedCandidate({ methodologyVersion: "source-method/v1" });
  const q1Cut = new Date("2026-05-05T19:54:22.775Z");
  const row = frozenVintageRow(canonical, {
    vintageLabel: vintage,
    canonicalCandidateId: null,
    civicaPublicationVersion: vintage,
    methodologyVersion: "v0.2-beta",
    derivationVersionKey: "derivation/legacy-unversioned/country_fact_vintages",
    cutAtTimestamp: q1Cut,
  });
  const release = {
    vintageLabel: vintage,
    cutAtTimestamp: q1Cut,
    methodologyVersion: "v0.2-beta",
    resolverVersionHash: "legacy-unrecorded",
    completenessStatus: "canonical_only_legacy",
    candidateCount: null,
    winnerCount: 1,
    candidateSetChecksum: null,
    winnerSetChecksum: "e".repeat(64),
    inputManifest: {
      schemaVersion: "reconciliation-candidate-input-manifest/v1",
      status: "historical-inputs-not-retained",
    },
  };
  assert.doesNotThrow(() => validateFrozenReleaseRows({ release, rows: [row] }));
  assert.throws(
    () => validateFrozenReleaseRows({
      release,
      rows: [{ ...row, methodologyVersion: "future-method" }],
    }),
    /row identity disagrees/,
  );
  assert.throws(
    () => validateFrozenReleaseRows({
      release: { ...release, completenessStatus: "staging" },
      rows: [row],
    }),
    /unpublished/,
  );
});

test("complete-candidate reads return the retained payload and resolver decision verbatim", () => {
  const canonical = retainedCandidate();
  const rejected = retainedCandidate({
    id: "source-row-rejected",
    sourceId: "other-source",
    status: "rejected",
    factValue: "rejected value",
  });
  const decisionTrace = [{
    code: "canonical_selection" as const,
    outcome: "retained_winner",
    detail: "This exact explanation was frozen at the cut.",
    sourceIds: [canonical.sourceId],
  }];
  const resolutions = frozenResolutionsFromRows({
    jurisdictionId: canonical.jurisdictionId,
    candidateSetStatus: "complete_candidates",
    vintageRows: [frozenVintageRow(canonical)],
    candidateRows: [
      frozenCandidateRow({
        id: "candidate-winner",
        candidate: canonical,
        isCanonicalAtCut: true,
        decisionReason: "fresher_winner",
        decisionTrace,
      }),
      frozenCandidateRow({
        id: "candidate-rejected",
        candidate: rejected,
        isCanonicalAtCut: false,
      }),
    ],
  });

  const result = resolutions[canonical.factKey];
  assert.strictEqual(result.canonical, canonical);
  assert.deepEqual(result.all, [canonical, rejected]);
  assert.deepEqual(result.alternates, [canonical]);
  assert.equal(result.decisionReason, "fresher_winner");
  assert.strictEqual(result.decisionTrace, decisionTrace);
  assert.equal(result.canonicalIsProjection, true);
  assert.equal(result.isDisputed, true);
});

test("complete-candidate reads fail closed when retained winner evidence is incomplete", () => {
  const canonical = retainedCandidate();
  const vintageRow = frozenVintageRow(canonical, {
    canonicalCandidateId: "missing-candidate",
    isDisputedAtCut: false,
  });
  assert.throws(
    () => frozenResolutionsFromRows({
      jurisdictionId: canonical.jurisdictionId,
      candidateSetStatus: "complete_candidates",
      vintageRows: [vintageRow],
      candidateRows: [],
    }),
    /missing its retained winner/,
  );
  assert.throws(
    () => frozenResolutionsFromRows({
      jurisdictionId: canonical.jurisdictionId,
      candidateSetStatus: "complete_candidates",
      vintageRows: [frozenVintageRow(canonical)],
      candidateRows: [{
        ...frozenCandidateRow({
          id: "candidate-winner",
          candidate: canonical,
          isCanonicalAtCut: true,
          decisionReason: "single_source",
          decisionTrace: [{
            code: "canonical_selection",
            outcome: "selected",
            detail: "retained",
            sourceIds: [canonical.sourceId],
          }],
        }),
        candidateContentHash: "f".repeat(64),
      }],
    }),
    /identity or evidence disagrees/,
  );
});
