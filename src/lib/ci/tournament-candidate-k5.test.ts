import assert from "node:assert/strict";
import test from "node:test";
import { K5_RELATION_TAXONOMY, k5RelationErrors, runK5RelationCandidateExtraction } from "./tournament-candidate-k5";

test("K5 extracts a cited candidate without asserting an institutional edge", () => {
  const rows = runK5RelationCandidateExtraction([{ jurisdictionId: "j1", iso3: "AAA", constitutionId: "c1", constitutionYear: 2020, constituteProjectId: "aaa", topicKey: "override", topicLabel: "Veto override procedure", sectionId: "s1", articleLabel: "Article 2", excerptHtml: "<p>The assembly may override a veto.</p>" }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].relationType, "overrides_veto"); assert.equal(rows[0].endpointState, "pending_blinded_coding"); assert.equal(k5RelationErrors(rows).length, 0); assert.equal("score" in rows[0], false);
});

test("K5 taxonomy is closed and has no duplicate topic rules", () => { assert.equal(new Set(K5_RELATION_TAXONOMY.map((row) => row.topicKey)).size, K5_RELATION_TAXONOMY.length); });
