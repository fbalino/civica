import assert from "node:assert/strict";
import test from "node:test";
import { metadataFromResolutions, parseAtlasReadSelection } from "../read-selection";

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
  assert.deepEqual(metadataFromResolutions({ mode: "vintage", asOf: vintage }, {}, { cutoffAt: "2026-05-05T19:54:22.775Z", retrievedThrough: "2026-04-30T12:00:00.000Z", methodologyVersions: ["v0.2-beta"] }), {
    mode: "vintage", asOf: vintage, vintage, cutoffAt: "2026-05-05T19:54:22.775Z", retrievedThrough: "2026-04-30T12:00:00.000Z", methodologyVersions: ["v0.2-beta"], candidateSetStatus: "canonical_only_legacy", candidateSetChecksum: null, winnerSetChecksum: null, resolverVersionHash: null,
  });
});
