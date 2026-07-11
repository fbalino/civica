import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildConfirmatoryDecision, tournamentDecisionErrors } from "../src/lib/ci/tournament-decision";

const checked = JSON.parse(readFileSync("data/releases/index-tournament-confirmatory-decision-v1/decision.v1.json", "utf8"));
const oos = JSON.parse(readFileSync("data/releases/index-oos-validation-v1/result.v1.json", "utf8"));
const k2 = JSON.parse(readFileSync("data/releases/k2-concordance-prototype-v1/manifest.v1.json", "utf8"));
const k3 = JSON.parse(readFileSync("data/releases/k3-power-transfer-ledger-prototype-v1/manifest.v1.json", "utf8"));
const k4 = JSON.parse(readFileSync("data/releases/k4-constitution-practice-pairings-2024-v1/manifest.v1.json", "utf8"));
const k5 = JSON.parse(readFileSync("data/releases/k5-institutional-relation-candidates-v1/manifest.v1.json", "utf8"));
const rebuilt = buildConfirmatoryDecision({ k1ReproductionR2: oos.artifacts.K1.publicInputReproductionR2, k2MidpointR2: k2.developmentDiagnostics.midpointArtifactR2, k2DropOneRate: oos.artifacts.K2.finalDropOneTercileChangeRate, k3EveryRowCited: k3.everyRowHasStatementCitation, k3HistoricalStates: k3.transferStatesComputed, k4ZeroAggregation: k4.prohibitedOutputs.includes("no aggregation across constructs"), k5ZeroWeightedTotal: k5.graphEdgesPublished === 0 && k5.prohibitedOutputs.includes("no weighted relation total") });
assert.deepEqual(tournamentDecisionErrors(checked), []);
assert.deepEqual(checked, rebuilt);
console.log(`PASS — ${checked.releaseId}: all ${checked.thresholds.length} thresholds applied; no winner.`);
