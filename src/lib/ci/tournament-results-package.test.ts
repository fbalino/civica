import assert from "node:assert/strict";
import test from "node:test";
import { TOURNAMENT_ERROR_LEDGER, TOURNAMENT_PACKAGE_ARTIFACTS, TOURNAMENT_REPRODUCTION_COMMANDS, buildArtifactInventoryCsv, tournamentResultsPackageErrors } from "./tournament-results-package";

test("tournament package closes candidates, baselines, results, tables, figures, and pending failures", () => {
  assert.deepEqual(TOURNAMENT_PACKAGE_ARTIFACTS.filter((row) => row.role === "candidate").map((row) => row.id).sort(), ["k0", "k1", "k2", "k3", "k4", "k5"]);
  assert.ok(TOURNAMENT_PACKAGE_ARTIFACTS.some((row) => row.role === "baseline"));
  assert.ok(TOURNAMENT_PACKAGE_ARTIFACTS.some((row) => row.role === "table"));
  assert.ok(TOURNAMENT_PACKAGE_ARTIFACTS.some((row) => row.role === "figure"));
  assert.ok(TOURNAMENT_REPRODUCTION_COMMANDS.length >= 17);
  assert.ok(TOURNAMENT_ERROR_LEDGER.some((row) => row.state === "pending_humans"));
});

test("package validation forbids winner selection and unlabeled exploratory output", () => {
  const fixture = { schemaVersion: "civica-index-tournament-results-package/v1", releaseId: "civica-index-tournament-results-v1", artifacts: Array(TOURNAMENT_PACKAGE_ARTIFACTS.length), reproduction: { commands: Array(TOURNAMENT_REPRODUCTION_COMMANDS.length) }, analysisSeparation: { exploratoryArtifacts: [], policy: "Exploratory work is separately labelled." }, errorLedger: { entries: TOURNAMENT_ERROR_LEDGER.length }, winnerSelected: false };
  assert.deepEqual(tournamentResultsPackageErrors(fixture), []);
  assert.match(tournamentResultsPackageErrors({ ...fixture, winnerSelected: true }).join(" "), /winner/);
  assert.match(buildArtifactInventoryCsv([{ id: "a", role: "result", analysisClass: "confirmatory", bytes: 1, sha256: "f".repeat(64), path: "a.json" }]), /artifact_id/);
});
