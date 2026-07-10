import assert from "node:assert/strict";
import test from "node:test";
import { buildFactCoverageReport } from "../fact-coverage";

const sources = [
  { id: "cia_factbook", baseUrl: "https://cia.example", license: "PD" },
  { id: "wikidata", baseUrl: "https://wd.example", license: "CC0" },
  { id: "world_bank", baseUrl: "https://wb.example", license: "CC-BY" },
  { id: "imf_weo", baseUrl: "https://imf.example", license: "Terms" },
];

test("coverage groups observations by jurisdiction and fact key", () => {
  const report = buildFactCoverageReport({
    generatedAt: "2026-07-10T00:00:00.000Z",
    sources,
    facts: [
      {
        id: "1",
        jurisdictionId: "a",
        jurisdictionSlug: "alpha",
        jurisdictionName: "Alpha",
        factKey: "population",
        sourceId: "cia_factbook",
        sourceUrl: null,
        retrievedAt: "2026-01-01",
      },
      {
        id: "2",
        jurisdictionId: "a",
        jurisdictionSlug: "alpha",
        jurisdictionName: "Alpha",
        factKey: "population",
        sourceId: "world_bank",
        sourceUrl: "https://wb.example/a",
        retrievedAt: "2026-06-01",
      },
      {
        id: "3",
        jurisdictionId: "a",
        jurisdictionSlug: "alpha",
        jurisdictionName: "Alpha",
        factKey: "gdp",
        sourceId: "world_bank",
        sourceUrl: "https://wb.example/a",
        retrievedAt: "2026-06-01",
      },
      {
        id: "4",
        jurisdictionId: "a",
        jurisdictionSlug: "alpha",
        jurisdictionName: "Alpha",
        factKey: "gdp",
        sourceId: "imf_weo",
        sourceUrl: "https://imf.example/a",
        retrievedAt: "2026-06-01",
      },
    ],
    statements: [],
    disputes: [],
  });
  assert.equal(report.facts.activeRows, 4);
  assert.equal(report.facts.total, 2);
  assert.equal(report.facts.oneSource, 0);
  assert.equal(report.facts.twoPlusIndependentSources, 1);
  assert.equal(report.facts.sourceLinked, 2);
});

test("secondary compilations do not manufacture independent families", () => {
  const report = buildFactCoverageReport({
    generatedAt: "2026-07-10T00:00:00.000Z",
    sources,
    facts: [
      {
        id: "1",
        jurisdictionId: "a",
        jurisdictionSlug: "alpha",
        jurisdictionName: "Alpha",
        factKey: "population",
        sourceId: "cia_factbook",
        sourceUrl: null,
        retrievedAt: "2026-06-01",
      },
      {
        id: "2",
        jurisdictionId: "a",
        jurisdictionSlug: "alpha",
        jurisdictionName: "Alpha",
        factKey: "population",
        sourceId: "wikidata",
        sourceUrl: "https://wd.example/a",
        retrievedAt: "2026-06-01",
      },
    ],
    statements: [],
    disputes: [],
  });
  assert.equal(report.facts.twoPlusIndependentSources, 0);
});

test("staleness excludes frozen archives and flags old live rows", () => {
  const report = buildFactCoverageReport({
    generatedAt: "2026-07-10T00:00:00.000Z",
    sources,
    facts: [
      {
        id: "1",
        jurisdictionId: "a",
        jurisdictionSlug: "alpha",
        jurisdictionName: "Alpha",
        factKey: "population",
        sourceId: "cia_factbook",
        sourceUrl: null,
        retrievedAt: "2020-01-01",
      },
      {
        id: "2",
        jurisdictionId: "a",
        jurisdictionSlug: "alpha",
        jurisdictionName: "Alpha",
        factKey: "gdp",
        sourceId: "world_bank",
        sourceUrl: "https://wb.example/a",
        retrievedAt: "2025-01-01",
      },
    ],
    statements: [],
    disputes: [],
  });
  assert.equal(report.facts.staleRows, 1);
});

test("source linkage requires registry license and row or source URL", () => {
  const report = buildFactCoverageReport({
    generatedAt: "2026-07-10T00:00:00.000Z",
    sources: [{ id: "broken", baseUrl: null, license: "" }],
    facts: [
      {
        id: "1",
        jurisdictionId: "a",
        jurisdictionSlug: "alpha",
        jurisdictionName: "Alpha",
        factKey: "x",
        sourceId: "broken",
        sourceUrl: null,
        retrievedAt: "2026-06-01",
      },
    ],
    statements: [],
    disputes: [],
  });
  assert.equal(report.facts.sourceLinked, 0);
});

test("unresolved disputes and statement linkage are reported separately", () => {
  const report = buildFactCoverageReport({
    generatedAt: "2026-07-10T00:00:00.000Z",
    sources,
    facts: [
      {
        id: "1",
        jurisdictionId: "a",
        jurisdictionSlug: "alpha",
        jurisdictionName: "Alpha",
        factKey: "x",
        sourceId: "world_bank",
        sourceUrl: null,
        retrievedAt: "2026-06-01",
      },
    ],
    statements: [
      {
        id: "s1",
        subjectTable: "jurisdictions",
        subjectId: "a",
        predicate: "capital",
        sourceId: "cia_factbook",
        sourceUrl: null,
        retrievedAt: "2026-06-01",
      },
    ],
    disputes: [{ jurisdictionId: "a", factKey: "x", status: "open" }],
  });
  assert.equal(report.facts.unresolvedDisputes, 1);
  assert.equal(report.statements.total, 1);
  assert.equal(report.statements.sourceLinked, 1);
});
