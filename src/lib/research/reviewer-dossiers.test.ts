import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_REVIEWER_DRAFT_SIGNATORY,
  buildReviewerDossiers,
  reviewerDossierErrors,
} from "./reviewer-dossiers";

test("every primary and alternate receives a bounded unsent dossier", () => {
  const bundle = buildReviewerDossiers();
  assert.deepEqual(reviewerDossierErrors(bundle), []);
  assert.equal(bundle.dossiers.length, 18);
  assert.ok(bundle.dossiers.every(({ contacted }) => !contacted));
  assert.ok(
    bundle.dossiers.every(({ contactDraft }) =>
      contactDraft.body.includes(`\n${CURRENT_REVIEWER_DRAFT_SIGNATORY}\n`),
    ),
  );
});
