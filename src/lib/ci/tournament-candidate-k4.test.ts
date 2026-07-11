import assert from "node:assert/strict";
import test from "node:test";
import { k4PairingErrors, runK4PairingPrototype } from "./tournament-candidate-k4";

test("K4 preserves source text and uncertainty without manufacturing a gap", () => {
  const outputs = runK4PairingPrototype([{ jurisdictionId: "j1", iso3: "AAA", constitutionId: "c1", constitutionYear: 2020, constituteProjectId: "aaa", topicKey: "judind", topicLabel: "Judicial independence", sectionId: "s1", articleLabel: "Article 1", excerptHtml: "<p>Courts are independent.</p>" }], [{ jurisdictionId: "j1", iso3: "AAA", periodYear: 2024, indicatorId: "v2juhcind", value: 1.2, uncertaintyLower: 0.8, uncertaintyUpper: 1.6, missingReason: null, sourceVintage: "v15", artifactHash: "a".repeat(64) }]);
  assert.equal(outputs.length, 3);
  const judicial = outputs.find((row) => row.constructId === "high_court_independence_in_practice")!;
  assert.equal(judicial.constitutionalEvidence.excerpts[0].excerptHtml, "<p>Courts are independent.</p>");
  assert.equal(judicial.practiceEvidence.uncertaintyLower, 0.8);
  assert.equal(k4PairingErrors(outputs).length, 0);
  assert.equal("gap" in judicial, false);
});
