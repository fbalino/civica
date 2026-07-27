import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIncidentFindingKey,
  type IncidentCandidate,
  type IncidentResolutionFinding,
} from "./incident-resolution";
import { buildIncidentMergeGroups } from "./incident-repair";

function candidate(id: string, sourceCount: number): IncidentCandidate {
  return {
    incidentId: id,
    eventId: `event-${id}`,
    clusterId: `cluster-${id}`,
    origin: "persisted",
    jurisdictionId: "country",
    eventDate: "2026-07-10",
    headline: "Same retained incident",
    body: null,
    sourceCount,
    publicationStatus: "unpublished",
    reviewStatus: "machine",
    categoryId: "court_ruling",
    dimension: "rol",
    direction: "negative",
    severity: "moderate_neg",
    createdAt: "2026-07-10T00:00:00Z",
  };
}

function confirmed(left: string, right: string): IncidentResolutionFinding {
  const payload = {
    disposition: "confirmed_merge" as const,
    candidateIds: [left, right].sort(),
    canonicalIncidentId: left,
    duplicateIncidentId: right,
    reasonCode: "fixture",
    hoursApart: 0,
    exactNormalizedMatch: true,
    exactNormalizedHeadlineMatch: true,
    tokenSimilarity: 1,
    anchorOverlap: 1,
    semanticSimilarity: null,
    classificationCompatible: true,
  };
  return { ...payload, findingKey: buildIncidentFindingKey(payload) };
}

test("transitive duplicate pairs become one merge with one stable survivor", () => {
  const candidates = [candidate("a", 5), candidate("b", 2), candidate("c", 1)];
  const groups = buildIncidentMergeGroups(candidates, [
    confirmed("b", "c"),
    confirmed("a", "b"),
  ]);
  assert.deepEqual(groups, [
    {
      canonicalIncidentId: "a",
      duplicateIncidentIds: ["b", "c"],
      incidentIds: ["a", "b", "c"],
      findingKeys: groups[0].findingKeys,
    },
  ]);
  assert.equal(groups[0].findingKeys.length, 2);
});

test("an unknown candidate in a confirmed finding fails closed", () => {
  assert.throws(
    () => buildIncidentMergeGroups([candidate("a", 1)], [confirmed("a", "missing")]),
    /unknown candidate/,
  );
});
