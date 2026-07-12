import assert from "node:assert/strict";
import test from "node:test";

import {
  buildElectionResearchExport,
  electionResearchExportCsv,
  ELECTION_RESEARCH_CSV_HEADER,
  type QualifiedElectionResearchRow,
} from "./research-export";

function row(
  id: string,
  sourceId: "wikidata" | "ipu_parline",
  temporalClass: "historical" | "projection_due" = "historical",
): QualifiedElectionResearchRow {
  return {
    election: {
      id,
      jurisdictionId: "jur-1",
      electionDate:
        temporalClass === "projection_due" ? "2030-05-01" : "2024-05-01",
      electionType: sourceId === "wikidata" ? "presidential" : "legislative",
      electionName: "Election",
      electoralSystem: sourceId === "wikidata" ? "Unproven manual label" : null,
      bodyId: null,
      turnoutPercent: null,
      registeredVoters: null,
      totalValidVotes: null,
      wikidataQid: sourceId === "wikidata" ? "Q1" : null,
      dateConfidence:
        temporalClass === "projection_due" ? "estimated" : "confirmed",
      createdAt: null,
    },
    jurisdiction: {
      id: "jur-1",
      slug: "example",
      name: "Example",
      iso2: "EX",
      iso3: "EXP",
      continent: "Europe",
      type: "sovereign_state",
      statusSourceIds: ["un_m49"],
      statusReviewedAt: "2026-07-10",
      statusNote: "Example status.",
      administeringJurisdictionIso3: null,
      statusDisputed: false,
      status: {
        version: "jurisdiction-status/v1",
        type: "sovereign_state",
        label: "UN member state",
        note: "Example status.",
        reviewedAt: "2026-07-10",
        administeringJurisdictionIso3: null,
        disputed: false,
        includeInSovereignStateCounts: true,
        sources: [
          {
            id: "un_m49",
            label: "UN M49",
            url: "https://unstats.un.org/unsd/methodology/m49/",
          },
        ],
      },
    },
    results: [],
    audit: {
      inputIndex: 0,
      rowId: id,
      electionDate:
        temporalClass === "projection_due" ? "2030-05-01" : "2024-05-01",
      normalizedType: sourceId === "wikidata" ? "presidential" : "legislative",
      dateBasis:
        temporalClass === "projection_due"
          ? "derived_term_projection"
          : "source_confirmed",
      datePrecision: temporalClass === "projection_due" ? "year" : "day",
      dateRole:
        temporalClass === "projection_due"
          ? "derived_due_date"
          : "point_in_time",
      sourceEventStatus:
        temporalClass === "projection_due" ? "unknown" : "source_dated",
      temporalClass,
      disposition:
        temporalClass === "projection_due"
          ? "projection_only"
          : "qualified_event",
      conceptualEventKey: `jur-1|event|${id}`,
      chamberContestKey: `jur-1|contest|${id}`,
      primaryRowId: id,
      relatedContestRowIds: [],
      jurisdiction: {
        id: "jur-1",
        slug: "example",
        status: "sovereign_state",
        inScope: true,
      },
      jurisdictionIdentity: null,
      evidence: {
        sourceId,
        license: sourceId === "wikidata" ? "CC0" : "CC-BY-NC-SA-4.0",
        retrievedAt: "2026-07-05T00:00:00.000Z",
        ageDays: 7,
        freshness: "current",
        rightsReview: sourceId === "wikidata" ? "verified" : "pending",
        publicDisplay: true,
      },
      fieldEligibility: { turnout: false, results: false },
      fieldEvidence: { turnout: null, results: null },
      issueCodes: [],
    },
    eventSourceUrl:
      sourceId === "wikidata"
        ? "https://www.wikidata.org/wiki/Q1"
        : "https://api.data.ipu.org/v1/elections/example",
  } as QualifiedElectionResearchRow;
}

test("exports only verified Wikidata rows and reports IPU/projection withholding", () => {
  const document = buildElectionResearchExport({
    rows: [
      row("wd", "wikidata"),
      row("ipu", "ipu_parline"),
      row("projection", "ipu_parline", "projection_due"),
    ],
    filters: {},
    auditVersion: "election-corpus-audit/v1",
    auditAsOf: "2026-07-12",
    generatedAt: "2026-07-12T00:00:00.000Z",
  });
  assert.deepEqual(
    document.data.map((entry) => entry.id),
    ["wd"],
  );
  assert.equal(document.withheld.rows, 2);
  assert.equal(document.withheld.projectionRows, 1);
  assert.deepEqual(
    document.withheld.bySource.map((entry) => [entry.sourceId, entry.count]),
    [["ipu_parline", 2]],
  );
  assert.equal(document.data[0].event.date.timeZone, null);
  assert.equal(
    document.data[0].event.date.timeZoneStatus,
    "not_provided_by_source",
  );
  assert.equal(document.data[0].event.electoralSystem, null);
  assert.deepEqual(
    document.withheld.fields.map((field) => [field.field, field.count]),
    [["electoralSystem", 1]],
  );
});

test("filters are applied before rights withholding and JSON/CSV counts agree", () => {
  const document = buildElectionResearchExport({
    rows: [row("wd", "wikidata"), row("ipu", "ipu_parline")],
    filters: { type: "presidential", from: "2024-01-01", to: "2024-12-31" },
    auditVersion: "election-corpus-audit/v1",
    auditAsOf: "2026-07-12",
    generatedAt: "2026-07-12T00:00:00.000Z",
  });
  assert.equal(document.meta.auditedRowsMatchingFilters, 1);
  assert.equal(document.meta.qualifiedEventOrContestRowsMatchingFilters, 1);
  assert.equal(document.meta.projectionRowsMatchingFilters, 0);
  assert.equal(document.meta.emittedRows, 1);
  assert.equal(document.withheld.rows, 0);
  const csv = electionResearchExportCsv(document);
  assert.ok(csv.startsWith(`${ELECTION_RESEARCH_CSV_HEADER}\n`));
  assert.match(csv, /record,wd,example/);
  assert.doesNotMatch(csv, /,ipu,/);
});
