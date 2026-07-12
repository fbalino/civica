import assert from "node:assert/strict";
import test from "node:test";

import {
  ELECTION_CORPUS_AUDIT,
  getElectionProjectionDisplayGroupCount,
  getElectionPublicFutureKey,
  isAuditedPublicElection,
  matchesAuditedElectionContent,
} from "./corpus-audit-runtime";
import {
  electionIntegrityFingerprint,
  type ElectionIntegrityContent,
} from "./corpus-audit-integrity";

test("public projection keys collapse unlabeled chamber-derived duplicates", () => {
  const projectionRows = ELECTION_CORPUS_AUDIT.rows.filter(
    (row) => row.disposition === "projection_only",
  );
  const publicKeys = new Set(
    projectionRows.map((row) => getElectionPublicFutureKey(row.rowId)),
  );

  assert.equal(projectionRows.length, 230);
  assert.ok(projectionRows.every((row) => row.datePrecision === "year"));
  assert.equal(publicKeys.has(null), false);
  assert.equal(publicKeys.size, 168);
  assert.equal(getElectionProjectionDisplayGroupCount(), publicKeys.size);
});

test("source-dated future rows retain their conceptual event identity", () => {
  const sourceDatedRows = ELECTION_CORPUS_AUDIT.rows.filter(
    (row) =>
      row.temporalClass === "source_dated_upcoming" &&
      (row.disposition === "qualified_event" ||
        row.disposition === "qualified_contest"),
  );

  assert.equal(sourceDatedRows.length, 17);
  assert.equal(
    new Set(sourceDatedRows.map((row) => row.conceptualEventKey)).size,
    17,
  );
  for (const row of sourceDatedRows) {
    assert.equal(getElectionPublicFutureKey(row.rowId), row.conceptualEventKey);
  }
});

test("public qualification fails closed when live content is not the audited content", () => {
  const row = ELECTION_CORPUS_AUDIT.rows.find(
    (candidate) => candidate.disposition === "qualified_event",
  );
  assert.ok(row);
  const expected = ELECTION_CORPUS_AUDIT.rowContentFingerprints[row.rowId];

  assert.equal(matchesAuditedElectionContent(row.rowId, expected), true);
  assert.equal(isAuditedPublicElection(row.rowId, expected), true);
  assert.equal(matchesAuditedElectionContent(row.rowId, null), false);
  assert.equal(isAuditedPublicElection(row.rowId, `${expected}x`), false);
});

test("explicit Wikidata P1001 scope conflicts are quarantined", () => {
  const fixtures = [
    ["Q23018343", "Q11703"],
    ["Q15206389", "Q34754"],
    ["Q123751092", "Q3995"],
  ] as const;

  for (const [sourceRecordId, scopeJurisdictionId] of fixtures) {
    const row = ELECTION_CORPUS_AUDIT.rows.find(
      (candidate) =>
        candidate.jurisdictionIdentity?.sourceRecordId === sourceRecordId,
    );
    assert.ok(row, `missing audited fixture ${sourceRecordId}`);
    assert.equal(row.disposition, "quarantined");
    assert.equal(row.jurisdictionIdentity?.status, "mismatch");
    assert.equal(
      row.jurisdictionIdentity?.statusReason,
      "explicit_scope_mismatch",
    );
    assert.deepEqual(row.jurisdictionIdentity?.observedScopeJurisdictionIds, [
      scopeJurisdictionId,
    ]);
    assert.ok(row.issueCodes.includes("JURISDICTION_IDENTITY_MISMATCH"));
  }
});

test("qualified field-coverage counts exclude quarantined evidence", () => {
  const publicRows = ELECTION_CORPUS_AUDIT.rows.filter(
    (row) =>
      row.disposition === "qualified_event" ||
      row.disposition === "qualified_contest",
  );
  assert.equal(ELECTION_CORPUS_AUDIT.qualified.turnoutEligibleRows, 313);
  assert.equal(ELECTION_CORPUS_AUDIT.qualified.resultEligibleRows, 174);
  assert.equal(
    ELECTION_CORPUS_AUDIT.qualified.turnoutEligibleRows,
    publicRows.filter((row) => row.fieldEligibility.turnout).length,
  );
  assert.equal(
    ELECTION_CORPUS_AUDIT.qualified.resultEligibleRows,
    publicRows.filter((row) => row.fieldEligibility.results).length,
  );
});

test("row fingerprint binds every public election, result, and evidence field", () => {
  const base: ElectionIntegrityContent = {
    id: "election-1",
    jurisdictionId: "jurisdiction-1",
    jurisdictionStatus: "sovereign_state",
    electionDate: "2026-01-01",
    electionType: "legislative",
    electionName: "2026 election",
    electoralSystem: "list_pr",
    bodyId: "body-1",
    turnoutPercent: 70,
    registeredVoters: 100,
    totalValidVotes: 70,
    wikidataQid: "Q1",
    dateConfidence: "confirmed",
    jurisdictionIdentity: {
      basis: "wikidata_p17_p1001",
      sourceId: "source-1",
      sourceRecordId: "Q1",
      expectedJurisdictionId: "Q2",
      observedJurisdictionIds: ["Q2"],
      observedScopeJurisdictionIds: [],
      statusReason: "country_match_scope_unspecified",
      status: "matched",
    },
    results: [
      {
        id: "result-1",
        partyName: "Party A",
        partyColor: null,
        partyWikidataQid: null,
        candidateName: null,
        votesCount: 70,
        votesPercent: 70,
        seatsWon: 7,
        isWinner: true,
      },
    ],
    statements: [
      {
        id: "statement-1",
        predicate: "election_date",
        sourceId: "source-1",
        sourceLicense: "CC0",
        sourceUrl: "https://example.test/election",
        retrievedAt: "2026-01-02T00:00:00.000Z",
        objectValue: "2026-01-01",
        sourceHash: "abc",
      },
    ],
  };
  const expected = electionIntegrityFingerprint(base);
  const mutations: ElectionIntegrityContent[] = [
    { ...base, jurisdictionId: "jurisdiction-2" },
    { ...base, jurisdictionStatus: "dependency_or_territory" },
    { ...base, electionDate: "2026-01-02" },
    { ...base, electionType: "presidential" },
    { ...base, bodyId: "body-2" },
    {
      ...base,
      jurisdictionIdentity: {
        ...base.jurisdictionIdentity!,
        status: "mismatch",
      },
    },
    { ...base, turnoutPercent: 71 },
    {
      ...base,
      results: [{ ...base.results[0], seatsWon: 8 }],
    },
    {
      ...base,
      statements: [{ ...base.statements[0], sourceId: "source-2" }],
    },
  ];
  for (const mutation of mutations)
    assert.notEqual(electionIntegrityFingerprint(mutation), expected);
});
