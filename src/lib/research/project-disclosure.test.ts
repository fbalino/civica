import assert from "node:assert/strict";
import test from "node:test";
import {
  PROJECT_DISCLOSURE,
  PROJECT_DISCLOSURE_ARTIFACT_PATH,
  PROJECT_DISCLOSURE_PUBLIC_SECTIONS,
  projectDisclosureErrors,
} from "./project-disclosure";

test("project disclosure records every confirmed owner field", () => {
  assert.deepEqual(projectDisclosureErrors(), []);
  assert.equal(PROJECT_DISCLOSURE.approvedBy, "Fernando Baliño");
  assert.equal(PROJECT_DISCLOSURE.funding.outsideFundersOrSponsors.length, 0);
  assert.equal(
    PROJECT_DISCLOSURE.sourceAndVendorRelationships
      .formalOrPrivilegedBeyondOrdinaryTerms.length,
    0,
  );
  assert.equal(
    PROJECT_DISCLOSURE.editorialControl.exceptionalThirdPartyControlRights.length,
    0,
  );
  assert.equal(PROJECT_DISCLOSURE_PUBLIC_SECTIONS.length, 6);
});

test("Atlas, Index, and future Pulse packets reuse one canonical artifact", () => {
  assert.equal(
    PROJECT_DISCLOSURE.publicationAuthorization.unchangedReviewerPacketReuse,
    true,
  );
  assert.deepEqual(
    PROJECT_DISCLOSURE.publicationAuthorization.reviewerPackets.map(
      ({ product, artifactPath }) => [product, artifactPath],
    ),
    [
      ["Atlas", PROJECT_DISCLOSURE_ARTIFACT_PATH],
      ["Index", PROJECT_DISCLOSURE_ARTIFACT_PATH],
      ["Pulse", PROJECT_DISCLOSURE_ARTIFACT_PATH],
    ],
  );
});
