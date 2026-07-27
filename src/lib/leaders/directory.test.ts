import assert from "node:assert/strict";
import test from "node:test";

import {
  annotateLeaderDirectory,
  leadershipCapacityFromSourceLabel,
  leaderDirectoryCountSummary,
  type LeaderDirectoryInput,
} from "./directory";

const input = (
  personId: string,
  officeType: "head_of_state" | "head_of_government",
  overrides: Partial<LeaderDirectoryInput> = {},
): LeaderDirectoryInput => ({
  termId: `${personId}-${officeType}`,
  personId,
  personName: personId,
  personWikidataQid: "Q100",
  officeId: officeType,
  officeName:
    officeType === "head_of_state" ? "President" : "Prime Minister",
  officeType,
  startDate: "2024-01-01",
  jurisdictionId: "j-1",
  jurisdictionName: "Example",
  jurisdictionSlug: "example",
  jurisdictionWikidataQid: "Q1",
  jurisdictionStatus: "sovereign_state",
  continent: "Europe",
  sourceId: "wikidata",
  sourceUrl: "https://www.wikidata.org/wiki/Q1",
  sourceLicense: "CC0",
  sourceRetrievedAt: "2026-07-01T00:00:00.000Z",
  sourceLastSyncAt: "2026-07-01T00:00:00.000Z",
  ...overrides,
});

test("capacity labels are derived only from explicit source wording", () => {
  assert.equal(
    leadershipCapacityFromSourceLabel("Acting President"),
    "acting",
  );
  assert.equal(
    leadershipCapacityFromSourceLabel("Interim Prime Minister"),
    "interim",
  );
  assert.equal(
    leadershipCapacityFromSourceLabel("Caretaker Prime Minister"),
    "caretaker",
  );
  assert.equal(
    leadershipCapacityFromSourceLabel("President"),
    "source_not_specified",
  );
});

test("co-leadership and dual office remain distinct states", () => {
  const rows = annotateLeaderDirectory([
    input("person-a", "head_of_state"),
    input("person-b", "head_of_state"),
    input("person-a", "head_of_government"),
  ]);
  assert.equal(rows[0].coLeadership, true);
  assert.equal(rows[1].coLeadership, true);
  assert.equal(rows[2].coLeadership, false);
  assert.equal(rows[0].dualOffice, true);
  assert.equal(rows[2].dualOffice, true);
  assert.equal(rows[1].dualOffice, false);
  assert.deepEqual(leaderDirectoryCountSummary(rows), {
    rows: 3,
    people: 2,
    jurisdictions: 1,
    ambiguousCapacity: 0,
    coLeadershipRows: 2,
    dualOfficeRows: 2,
  });
});
