import assert from "node:assert/strict";
import test from "node:test";

import { freezeCandidateObservation, replayCandidateRelease } from "../candidate-vintage";
import type { FactRow } from "../types";

const vintageLabel = "Civica Atlas Reconciled v0.3-beta — vintage 2026-Q2";
const cutAt = "2026-07-15T04:00:00.000Z";

function row(id: string, sourceId: string, value: number, retrievedAt: string): FactRow {
  return {
    id, jurisdictionId: "11111111-1111-4111-8111-111111111111", factKey: "population_total",
    factGroup: "B", category: "demographics", sourceId, sourceUrl: `https://example.test/${sourceId}`,
    wikidataQid: null, wikidataPid: null, wikidataRank: null, references: null,
    factValue: String(value), factValueNumeric: value, factUnit: "people", factYear: 2025,
    valueJson: null, valueStatus: "observed", valueStatusReason: null, asOf: "2025-01-01",
    dataVintageYear: 2025, retrievedAt, upstreamVintageLabel: `${sourceId}-2025`,
    methodologyVersion: "v0.3-beta", status: "active", statusReason: null, sourceNote: null,
    valueType: "measured", growthMethodology: null,
  };
}

function frozen(candidate: FactRow, sourceHash: string | null = null) {
  return freezeCandidateObservation({ vintageLabel, cutAt, candidate, sourceHash, sourceSnapshotId: null, adapterVersionHash: "sha256:adapter" });
}

test("offline replay is deterministic across candidate ordering", () => {
  const candidates = [frozen(row("wb", "world_bank", 100, "2026-07-01T00:00:00.000Z"), "sha256:payload"), frozen(row("cia", "cia_factbook", 99, "2026-06-01T00:00:00.000Z"))];
  const a = replayCandidateRelease({ vintageLabel, cutAt, methodologyVersion: "v0.3-beta", resolverVersionHash: "sha256:resolver", candidates });
  const b = replayCandidateRelease({ vintageLabel, cutAt, methodologyVersion: "v0.3-beta", resolverVersionHash: "sha256:resolver", candidates: [...candidates].reverse() });
  assert.deepEqual(a.manifest, b.manifest);
  assert.equal(a.manifest.candidateCount, 2);
  assert.equal(a.manifest.winnerCount, 1);
});

test("replay fails when a frozen candidate is mutated", () => {
  const candidate = frozen(row("wb", "world_bank", 100, "2026-07-01T00:00:00.000Z"));
  candidate.candidate.factValueNumeric = 101;
  assert.throws(() => replayCandidateRelease({ vintageLabel, cutAt, methodologyVersion: "v0.3-beta", resolverVersionHash: "sha256:resolver", candidates: [candidate] }), /hash drift/);
});

test("replay rejects duplicate source candidates for a fact", () => {
  const one = frozen(row("wb-1", "world_bank", 100, "2026-07-01T00:00:00.000Z"));
  const two = frozen(row("wb-2", "world_bank", 101, "2026-07-02T00:00:00.000Z"));
  assert.throws(() => replayCandidateRelease({ vintageLabel, cutAt, methodologyVersion: "v0.3-beta", resolverVersionHash: "sha256:resolver", candidates: [one, two] }), /Duplicate candidate identity/);
});

test("rows without an upstream payload hash retain an exact normalized-observation hash", () => {
  const candidate = frozen(row("cia", "cia_factbook", 99, "2026-06-01T00:00:00.000Z"));
  assert.equal(candidate.inputEvidenceKind, "normalized_observation_hash");
  assert.equal(candidate.inputEvidenceHash, candidate.candidateContentHash);
});
