import assert from "node:assert/strict";
import test from "node:test";
import { ADVISORY_BOARD_CHARTER, advisoryBoardCharterErrors } from "./advisory-board-charter";

test("advisory board charter closes remit, independence, service, and publication terms", () => {
  assert.deepEqual(advisoryBoardCharterErrors(), []);
  assert.equal(ADVISORY_BOARD_CHARTER.statusAndAuthority.advisoryOnly, true);
  assert.equal(ADVISORY_BOARD_CHARTER.statusAndAuthority.publicationVeto, false);
  assert.equal(ADVISORY_BOARD_CHARTER.appointment.termMonths, 24);
});

test("board service cannot imply endorsement or favorable paid review", () => {
  assert.match(ADVISORY_BOARD_CHARTER.publication.nonEndorsement, /validates neither/);
  assert.match(ADVISORY_BOARD_CHARTER.compensation.independence, /never depends/);
});
