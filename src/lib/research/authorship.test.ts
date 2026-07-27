import assert from "node:assert/strict";
import test from "node:test";
import { AUTHORSHIP_RECORD, CONTRIBUTOR_ROLE_TAXONOMY, authorshipErrors } from "./authorship";

test("authorship names one accountable independent human", () => {
  assert.deepEqual(authorshipErrors(), []);
  assert.equal(AUTHORSHIP_RECORD.responsibleAuthor.displayName, "Fernando Baliño");
  assert.equal(AUTHORSHIP_RECORD.responsibleAuthor.independentStatus, true);
  assert.equal(AUTHORSHIP_RECORD.responsibleAuthor.orcid, null);
});

test("every assigned contribution role belongs to the declared taxonomy", () => {
  const valid = new Set(CONTRIBUTOR_ROLE_TAXONOMY.map(({ id }) => id));
  for (const role of AUTHORSHIP_RECORD.responsibleAuthor.roles) assert.ok(valid.has(role));
});
