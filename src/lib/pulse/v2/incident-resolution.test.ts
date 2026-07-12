import assert from "node:assert/strict";
import test from "node:test";

import {
  planIncidentResolution,
  selectCanonicalIncident,
  type IncidentCandidate,
} from "./incident-resolution";

function candidate(
  incidentId: string,
  overrides: Partial<IncidentCandidate> = {},
): IncidentCandidate {
  return {
    incidentId,
    eventId: `event-${incidentId}`,
    clusterId: `cluster-${incidentId}`,
    origin: "new",
    jurisdictionId: "mexico",
    eventDate: "2026-07-10T12:00:00.000Z",
    headline: "Mexico court annuls Oaxaca election",
    body: null,
    sourceCount: 1,
    publicationStatus: "unpublished",
    reviewStatus: "machine",
    categoryId: "election_cancellation",
    dimension: "electoral",
    direction: "restrictive",
    severity: "material",
    createdAt: "2026-07-10T13:00:00.000Z",
    ...overrides,
  };
}

test("sequential ingest compares a new report with a recent persisted incident", () => {
  const plan = planIncidentResolution([
    candidate("persisted", { origin: "persisted" }),
    candidate("incoming"),
  ]);
  assert.equal(plan.findings.length, 1);
  assert.equal(plan.findings[0].disposition, "confirmed_merge");
  assert.deepEqual(plan.findings[0].candidateIds, ["incoming", "persisted"]);
});

test("ordinary ingest omits persisted-to-persisted comparisons", () => {
  const plan = planIncidentResolution([
    candidate("persisted-a", { origin: "persisted" }),
    candidate("persisted-b", { origin: "persisted" }),
  ]);
  assert.equal(plan.findings.length, 0);
});

test("bounded backfill compares persisted incidents with one another", () => {
  const plan = planIncidentResolution(
    [
      candidate("persisted-a", { origin: "persisted" }),
      candidate("persisted-b", { origin: "persisted", sourceCount: 2 }),
    ],
    { mode: "backfill" },
  );
  assert.equal(plan.findings.length, 1);
  assert.equal(plan.findings[0].disposition, "confirmed_merge");
  assert.deepEqual(plan.findings[0].candidateIds, [
    "persisted-a",
    "persisted-b",
  ]);
  assert.equal(plan.findings[0].canonicalIncidentId, "persisted-b");
});

test("backfill plans and hashes are invariant to persisted input order", () => {
  const rows = [
    candidate("persisted-a", { origin: "persisted", sourceCount: 2 }),
    candidate("persisted-b", { origin: "persisted" }),
    candidate("persisted-c", {
      origin: "persisted",
      headline: "A wholly unrelated report",
    }),
  ];
  assert.deepEqual(
    planIncidentResolution(rows, { mode: "backfill" }),
    planIncidentResolution([...rows].reverse(), { mode: "backfill" }),
  );
});

test("a multilingual semantic match remains a review candidate", () => {
  const plan = planIncidentResolution([
    candidate("english", { embedding: [1, 0] }),
    candidate("spanish", {
      headline: "Tribunal electoral de México invalida votación en Oaxaca",
      embedding: [0.99, 0.01],
    }),
  ]);
  assert.equal(plan.findings[0].disposition, "candidate_merge");
  assert.equal(
    plan.findings[0].reasonCode,
    "semantic_identity_candidate_requires_review",
  );
});

test("embedding-unavailable fallback is bounded and conservative", () => {
  const strong = planIncidentResolution([
    candidate("one", { headline: "Court annuls Oaxaca election today" }),
    candidate("two", { headline: "Oaxaca election annulled by court" }),
  ]).findings[0];
  assert.equal(strong.disposition, "candidate_merge");
  assert.equal(
    strong.reasonCode,
    "strong_anchor_lexical_fallback_requires_review",
  );

  const weak = planIncidentResolution([
    candidate("three", { headline: "Court announces election ruling" }),
    candidate("four", { headline: "Government schedules national vote" }),
  ]).findings[0];
  assert.equal(weak.disposition, "separate");
  assert.equal(weak.semanticSimilarity, null);
});

test("only an exact compatible identity inside the 48-hour window is confirmed automatically", () => {
  const finding = planIncidentResolution([
    candidate("first"),
    candidate("second", {
      sourceCount: 2,
      eventDate: "2026-07-11T11:00:00.000Z",
      jurisdictionId: null,
    }),
  ]).findings[0];
  assert.equal(finding.disposition, "confirmed_merge");
  assert.equal(finding.canonicalIncidentId, "second");
});

test("incompatible labels prevent an exact identity from being confirmed", () => {
  const finding = planIncidentResolution([
    candidate("first"),
    candidate("second", { direction: "expansive" }),
  ]).findings[0];
  assert.equal(finding.disposition, "candidate_merge");
  assert.equal(finding.classificationCompatible, false);
  assert.match(finding.reasonCode, /classification_conflict/);
});

test("an exact headline with divergent summaries confirms only on the same resolved country and date", () => {
  const confirmed = planIncidentResolution([
    candidate("first", { body: "A short wire summary." }),
    candidate("second", { body: "A longer independently written account." }),
  ]).findings[0];
  assert.equal(confirmed.exactNormalizedMatch, false);
  assert.equal(confirmed.exactNormalizedHeadlineMatch, true);
  assert.equal(confirmed.disposition, "confirmed_merge");

  const differentCountry = planIncidentResolution([
    candidate("third", { body: "A short wire summary." }),
    candidate("fourth", {
      body: "A longer independently written account.",
      jurisdictionId: "another-country",
    }),
  ]).findings[0];
  assert.equal(differentCountry.disposition, "separate");
});

test("unrelated same-day place anchors remain separate", () => {
  const finding = planIncidentResolution([
    candidate("election", { headline: "Oaxaca court annuls election" }),
    candidate("minister", {
      headline: "Oaxaca minister opens new hospital",
      categoryId: "public_service_change",
      dimension: "governance",
      direction: "expansive",
    }),
  ]).findings[0];
  assert.equal(finding.disposition, "separate");
});

test("blank headlines are quarantined before comparison or publication", () => {
  const plan = planIncidentResolution([
    candidate("blank", { headline: "   " }),
    candidate("valid"),
  ]);
  assert.equal(plan.findings.length, 1);
  assert.equal(plan.findings[0].disposition, "invalid");
  assert.equal(plan.findings[0].reasonCode, "blank_headline_quarantine");
});

test("canonical selection follows review, publication, evidence, time, then id", () => {
  const reviewed = candidate("reviewed", {
    reviewStatus: "human_current",
    publicationStatus: "unpublished",
    sourceCount: 1,
  });
  const published = candidate("published", {
    publicationStatus: "published",
    sourceCount: 10,
  });
  assert.equal(
    selectCanonicalIncident([published, reviewed]).incidentId,
    "reviewed",
  );

  const lexicalA = candidate("a", {
    publicationStatus: "published",
    sourceCount: 3,
    createdAt: "2026-07-01T00:00:00Z",
  });
  const lexicalB = candidate("b", {
    publicationStatus: "published",
    sourceCount: 3,
    createdAt: "2026-07-01T00:00:00Z",
  });
  assert.equal(selectCanonicalIncident([lexicalB, lexicalA]).incidentId, "a");
});

test("resolution plans and hashes are invariant to input order", () => {
  const rows = [
    candidate("persisted", { origin: "persisted", sourceCount: 4 }),
    candidate("new-a"),
    candidate("new-b", { headline: "A wholly unrelated report" }),
  ];
  assert.deepEqual(planIncidentResolution(rows), planIncidentResolution([...rows].reverse()));
});
