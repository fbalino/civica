import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildConfirmatoryDecision, tournamentDecisionErrors } from "../src/lib/ci/tournament-decision";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const oos = read("data/releases/index-oos-validation-v1/result.v1.json");
const k2 = read("data/releases/k2-concordance-prototype-v1/manifest.v1.json");
const k3 = read("data/releases/k3-power-transfer-ledger-prototype-v1/manifest.v1.json");
const k4 = read("data/releases/k4-constitution-practice-pairings-2024-v1/manifest.v1.json");
const k5 = read("data/releases/k5-institutional-relation-candidates-v1/manifest.v1.json");
const result = buildConfirmatoryDecision({
  k1ReproductionR2: oos.artifacts.K1.publicInputReproductionR2,
  k2MidpointR2: k2.developmentDiagnostics.midpointArtifactR2,
  k2DropOneRate: oos.artifacts.K2.finalDropOneTercileChangeRate,
  k3EveryRowCited: k3.everyRowHasStatementCitation,
  k3HistoricalStates: k3.transferStatesComputed,
  k4ZeroAggregation: k4.prohibitedOutputs.includes("no aggregation across constructs"),
  k5ZeroWeightedTotal: k5.graphEdgesPublished === 0 && k5.prohibitedOutputs.includes("no weighted relation total"),
});
const errors = tournamentDecisionErrors(result);
if (errors.length) throw new Error(errors.join("\n"));
const directory = "data/releases/index-tournament-confirmatory-decision-v1";
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/decision.v1.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${result.releaseId} (${result.thresholds.length} thresholds; ${result.outcome.status}).`);
