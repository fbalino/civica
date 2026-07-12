import assert from "node:assert/strict";
import test from "node:test";

import {
  auditElectionCorpus,
  type ElectionCorpusAuditInput,
  type ElectionCorpusRow,
} from "./corpus-audit";

const event = (sourceId = "ipu") => ({
  sourceId,
  statementId: `date:${sourceId}`,
  sourceLicense: sourceId === "ipu" ? "CC-BY-NC-SA-4.0" : "CC0",
  retrievedAt: sourceId === "stale" ? "2024-01-01" : "2026-07-01",
});
const base = (overrides: Partial<ElectionCorpusRow>): ElectionCorpusRow => ({
  id: "deu-2025",
  jurisdictionId: "deu",
  jurisdictionSlug: "germany",
  jurisdictionStatus: "sovereign_state",
  includeInElectionScope: true,
  electionType: "legislative",
  electionName: "2025 German federal election",
  electionDate: "2025-02-23",
  dateConfidence: "confirmed",
  datePrecision: "day",
  dateRole: "election_day",
  sourceEventStatus: "held",
  bodyId: "bundestag",
  jurisdictionIdentity: {
    basis: "ipu_election_code",
    sourceId: "ipu",
    sourceRecordId: "DE-LC01-E20250223",
    expectedJurisdictionId: "DE",
    observedJurisdictionIds: ["DE"],
    status: "matched",
  },
  provenance: { event: event() },
  ...overrides,
});

const run = (
  rows: ElectionCorpusRow[],
  overrides: Partial<ElectionCorpusAuditInput> = {},
) =>
  auditElectionCorpus({
    rows,
    asOf: "2026-07-12",
    upcomingFreshnessDays: 180,
    sources: [
      { id: "ipu", license: "CC-BY-NC-SA-4.0", retrievedAt: "2026-07-01" },
      { id: "wikidata", license: "CC0", retrievedAt: "2026-06-01" },
      { id: "stale", license: "CC0", retrievedAt: "2024-01-01" },
      { id: "bad-license", license: "restricted", retrievedAt: "2026-07-01" },
    ],
    rights: [
      {
        sourceId: "ipu",
        expectedLicense: "CC-BY-NC-SA-4.0",
        reviewStatus: "pending",
        publicDisplay: true,
        mayUseTurnout: true,
        mayUseResults: true,
      },
      {
        sourceId: "wikidata",
        expectedLicense: "CC0",
        reviewStatus: "verified",
        publicDisplay: true,
        mayUseTurnout: false,
        mayUseResults: false,
      },
      {
        sourceId: "stale",
        expectedLicense: "CC0",
        reviewStatus: "verified",
        publicDisplay: true,
        mayUseTurnout: false,
        mayUseResults: false,
      },
      {
        sourceId: "bad-license",
        expectedLicense: "CC0",
        reviewStatus: "verified",
        publicDisplay: true,
        mayUseTurnout: false,
        mayUseResults: false,
      },
      {
        sourceId: "display-blocked",
        expectedLicense: "CC0",
        reviewStatus: "verified",
        publicDisplay: false,
        mayUseTurnout: false,
        mayUseResults: false,
      },
    ],
    ...overrides,
  });

test("accounts for Germany, Bosnia and Poland exactly once and preserves jurisdiction scope", () => {
  const result = run([
    base({}),
    base({
      id: "bih-2022",
      jurisdictionId: "bih",
      jurisdictionSlug: "bosnia-and-herzegovina",
      electionName: "2022 Bosnia and Herzegovina general election",
      electionDate: "2022-10-02",
      bodyId: "house-representatives",
    }),
    base({
      id: "pol-2023",
      jurisdictionId: "pol",
      jurisdictionSlug: "poland",
      electionName: "2023 Polish parliamentary election",
      electionDate: "2023-10-15",
      bodyId: "sejm",
    }),
    base({
      id: "limited-2025",
      jurisdictionId: "xkx",
      jurisdictionSlug: "kosovo",
      jurisdictionStatus: "disputed_or_limited_recognition",
      includeInElectionScope: true,
      electionName: "2025 parliamentary election",
      electionDate: "2025-02-09",
      bodyId: "assembly",
    }),
  ]);
  assert.equal(result.inputRowCount, 4);
  assert.equal(result.accountedRowCount, 4);
  assert.deepEqual(
    result.rows.map((row) => row.inputIndex),
    [0, 1, 2, 3],
  );
  assert.equal(
    result.rows[3].jurisdiction.status,
    "disputed_or_limited_recognition",
  );
  assert.equal(result.rows[3].jurisdiction.inScope, true);
  assert.ok(result.rows.every((row) => row.disposition === "qualified_event"));
});

test("groups a valid bicameral election as one event with distinct chamber contests", () => {
  const result = run([
    base({ id: "upper", bodyId: "upper-house" }),
    base({ id: "lower", bodyId: "lower-house" }),
  ]);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].primaryRowId, "lower");
  assert.deepEqual(result.groups[0].relatedContestRowIds, ["upper"]);
  assert.notEqual(
    result.rows[0].chamberContestKey,
    result.rows[1].chamberContestKey,
  );
  assert.ok(
    result.rows.every((row) => !row.issueCodes.includes("EXACT_DUPLICATE")),
  );
  assert.deepEqual(
    result.rows.map((row) => row.disposition),
    ["qualified_contest", "qualified_event"],
  );
});

test("keeps a future estimate projection-only and separates basis from time class", () => {
  const result = run([
    base({
      id: "deu-estimate",
      electionName: "German federal election",
      electionDate: "2029-02-23",
      dateConfidence: "estimated",
      datePrecision: "year",
      dateRole: "derived_due_date",
      sourceEventStatus: "unknown",
    }),
  ]);
  assert.equal(result.rows[0].dateBasis, "derived_term_projection");
  assert.equal(result.rows[0].temporalClass, "projection_due");
  assert.equal(result.rows[0].disposition, "projection_only");
});

test("fails jurisdiction identity and source-status assessment closed", () => {
  const [missingIdentity, mismatch, unknownStatus] = run([
    base({ id: "missing-identity", jurisdictionIdentity: null }),
    base({
      id: "mismatched-identity",
      jurisdictionIdentity: {
        basis: "wikidata_p17",
        sourceId: "wikidata",
        sourceRecordId: "Q1",
        expectedJurisdictionId: "Q183",
        observedJurisdictionIds: ["Q142"],
        status: "mismatch",
      },
    }),
    base({ id: "unknown-status", sourceEventStatus: "unknown" }),
  ]).rows;

  assert.ok(
    missingIdentity.issueCodes.includes(
      "MISSING_JURISDICTION_IDENTITY_EVIDENCE",
    ),
  );
  assert.ok(mismatch.issueCodes.includes("JURISDICTION_IDENTITY_MISMATCH"));
  assert.ok(
    unknownStatus.issueCodes.includes("MISSING_EVENT_STATUS_ASSESSMENT"),
  );
  assert.ok(
    [missingIdentity, mismatch, unknownStatus].every(
      (row) => row.disposition === "quarantined",
    ),
  );
});

test("fails fields closed when turnout or results lack statement provenance", () => {
  const result = run([
    base({ turnoutPercent: 78.2, results: [{ party: "A", seats: 10 }] }),
  ]);
  assert.deepEqual(result.rows[0].fieldEligibility, {
    turnout: false,
    results: false,
  });
  assert.ok(result.rows[0].issueCodes.includes("UNSOURCED_TURNOUT"));
  assert.ok(result.rows[0].issueCodes.includes("UNSOURCED_RESULTS"));

  const sourced = run([
    base({
      turnoutPercent: 78.2,
      results: [{ party: "A", seats: 10 }],
      provenance: { event: event(), turnout: event(), results: event() },
    }),
  ]);
  assert.deepEqual(sourced.rows[0].fieldEligibility, {
    turnout: true,
    results: true,
  });
});

test("quarantines stale upcoming evidence, unknown sources, and license mismatches", () => {
  const result = run([
    base({
      id: "stale-upcoming",
      electionName: "2027 German federal election",
      electionDate: "2027-02-23",
      provenance: { event: event("stale") },
    }),
    base({ id: "unknown", provenance: { event: event("missing") } }),
    base({ id: "license", provenance: { event: event("bad-license") } }),
  ]);
  assert.ok(result.rows[0].issueCodes.includes("STALE_UPCOMING_EVIDENCE"));
  assert.equal(result.rows[0].evidence.freshness, "stale");
  assert.ok(result.rows[1].issueCodes.includes("UNKNOWN_SOURCE"));
  assert.ok(result.rows[2].issueCodes.includes("LICENSE_MISMATCH"));
  assert.ok(result.rows.every((row) => row.disposition === "quarantined"));
});

test("fails event publication closed when source display rights are blocked", () => {
  const result = run(
    [
      base({
        id: "display-blocked",
        provenance: { event: event("display-blocked") },
      }),
    ],
    {
      sources: [
        {
          id: "display-blocked",
          license: "CC0",
          retrievedAt: "2026-07-01",
        },
      ],
    },
  );

  assert.equal(result.rows[0].evidence.publicDisplay, false);
  assert.ok(result.rows[0].issueCodes.includes("EVENT_DISPLAY_RIGHTS_BLOCKED"));
  assert.equal(result.rows[0].disposition, "quarantined");
});

test("detects exact duplicates but does not discard the deterministic primary", () => {
  const duplicate = base({ id: "a" });
  const result = run([duplicate, { ...duplicate, id: "b" }]);
  assert.equal(result.groups[0].primaryRowId, "a");
  assert.equal(result.rows[0].disposition, "qualified_event");
  assert.equal(result.rows[1].disposition, "quarantined");
  assert.ok(result.rows[1].issueCodes.includes("EXACT_DUPLICATE"));
  assert.equal(result.issueCounts.EXACT_DUPLICATE, 1);
});

test("detects suspicious labels, date precision, subnational rows and unsupported types", () => {
  const result = run([
    base({
      id: "bad-label",
      electionName: "Postponed 2024 regional election",
      electionDate: "2025-01-01",
      electionType: "referendum",
      dateConfidence: null,
      datePrecision: "unknown",
      provenance: null,
    }),
  ]);
  assert.deepEqual(result.rows[0].issueCodes, [
    "CANCELLED_POSTPONED_OR_ANNULLED",
    "JANUARY_FIRST_YEAR_PRECISION_SUSPECTED",
    "MISSING_DATE_CONFIDENCE",
    "MISSING_EVENT_PROVENANCE",
    "NAME_DATE_YEAR_MISMATCH",
    "SUBNATIONAL_MARKER",
    "UNSUPPORTED_ELECTION_TYPE",
  ]);
  assert.equal(result.rows[0].disposition, "quarantined");
});

test("withholds imprecise, cancelled and non-national executive records", () => {
  const result = run([
    base({
      id: "year-only",
      electionType: "presidential",
      electionName: "2028 presidential election",
      electionDate: "2028-01-01",
      datePrecision: "year",
      dateRole: "point_in_time",
      sourceEventStatus: "source_dated",
      isNationalExecutiveSelection: true,
      provenance: { event: event("wikidata") },
    }),
    base({
      id: "cancelled",
      sourceEventStatus: "cancelled",
    }),
    base({
      id: "vice-president",
      electionType: "presidential",
      isNationalExecutiveSelection: false,
      provenance: { event: event("wikidata") },
    }),
  ]);
  assert.ok(result.rows[0].issueCodes.includes("IMPRECISE_SOURCE_DATE"));
  assert.ok(
    result.rows[1].issueCodes.includes("CANCELLED_POSTPONED_OR_ANNULLED"),
  );
  assert.ok(
    result.rows[2].issueCodes.includes("NON_NATIONAL_EXECUTIVE_SELECTION"),
  );
  assert.ok(result.rows.every((row) => row.disposition === "quarantined"));
});

test("rejects nondeterministic audit dates", () => {
  assert.throws(
    () => run([], { asOf: "today" }),
    /asOf must be an ISO calendar date/,
  );
});
