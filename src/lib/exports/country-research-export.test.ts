import assert from "node:assert/strict";
import test from "node:test";

import type { ResolverOutput, FactRow } from "@/lib/factbook/reconcile/types";
import type { SourceRightsRecord } from "@/lib/rights/manifest";
import {
  buildCountryResearchExport,
  countryResearchExportCsv,
  flattenCountryResearchExport,
} from "./country-research-export";

const row = (
  id: string,
  sourceId: string,
  value: number,
  overrides: Partial<FactRow> = {},
): FactRow => ({
  id,
  jurisdictionId: "france-id",
  factKey: "population_total",
  factGroup: "B",
  category: "People",
  sourceId,
  sourceUrl: `https://example.test/${sourceId}/france`,
  wikidataQid: null,
  wikidataPid: null,
  wikidataRank: null,
  references: null,
  factValue: String(value),
  factValueNumeric: value,
  factUnit: "people",
  factYear: 2024,
  valueJson: null,
  valueStatus: "observed",
  valueStatusReason: null,
  asOf: "2024-01-01",
  dataVintageYear: 2024,
  retrievedAt: "2026-01-02T00:00:00.000Z",
  upstreamVintageLabel: "2024",
  methodologyVersion: "v0.2-beta",
  status: "active",
  statusReason: null,
  sourceNote: null,
  valueType: "measured",
  growthMethodology: null,
  ...overrides,
});

const allowedRights = (sourceId: string): SourceRightsRecord => ({
  sourceId,
  licenseId: "CC-BY-4.0",
  termsUrl: `https://example.test/${sourceId}/terms`,
  reviewStatus: "verified",
  reviewedAt: "2026-07-10",
  publicExport: "allowed",
  commercialUse: true,
  derivatives: true,
  attributionRequired: true,
  shareAlikeRequired: false,
  restrictions: [],
});

const blockedRights = (sourceId: string): SourceRightsRecord => ({
  ...allowedRights(sourceId),
  reviewStatus: "pending",
  reviewedAt: null,
  publicExport: "pending-review",
});

function fixture() {
  const canonical = row("fr-wb", "world_bank", 68_170_000);
  const alternate = row("fr-wd", "wikidata", 68_100_000);
  const projection = row("fr-cia-proj", "cia_factbook", 68_521_974, {
    valueType: "projected",
    factYear: 2025,
  });
  const rejected = row("fr-wb-rejected", "world_bank", 999_999_999, {
    status: "rejected",
    statusReason: "Outside the population plausibility envelope",
  });
  const restricted = row("fr-restricted", "ipu_parline", 68_000_000);
  const resolution: ResolverOutput = {
    jurisdictionId: "france-id",
    factKey: "population_total",
    canonical,
    alternates: [canonical, alternate, projection, restricted],
    all: [canonical, alternate, projection, rejected, restricted],
    isDisputed: true,
    decisionReason: "fresher_winner",
    decisionTrace: [{
      code: "canonical_selection",
      outcome: "selected",
      detail: "World Bank selected for the France population fixture.",
      sourceIds: ["world_bank"],
    }],
    proposedDisputes: [],
    canonicalIsProjection: false,
  };
  const sourceIds = ["world_bank", "wikidata", "cia_factbook", "ipu_parline"];
  return buildCountryResearchExport({
    generatedAt: "2026-07-11T00:00:00.000Z",
    selection: { mode: "live", asOf: "live", vintage: null, cutoffAt: null, retrievedThrough: "2026-07-11T00:00:00.000Z", methodologyVersions: ["v0.2-beta"], candidateSetStatus: "live", candidateSetChecksum: null, winnerSetChecksum: null, resolverVersionHash: null },
    jurisdiction: {
      id: "france-id",
      slug: "france",
      name: "France",
      iso2: "FR",
      iso3: "FRA",
      status: "sovereign_state",
      statusDetails: {
        version: "jurisdiction-status/v1",
        type: "sovereign_state",
        label: "UN member state",
        note: "Listed by Civica as a sovereign state because it is in the closed UN member-state inventory.",
        reviewedAt: "2026-07-10",
        administeringJurisdictionIso3: null,
        disputed: false,
        includeInSovereignStateCounts: true,
        sources: [{
          id: "un_member_states",
          label: "United Nations Member States",
          url: "https://www.un.org/en/about-us/member-states",
        }],
      },
    },
    resolutions: { population_total: resolution },
    sources: new Map(sourceIds.map((id) => [id, {
      id,
      name: id,
      baseUrl: `https://example.test/${id}`,
      lastSyncAt: "2026-07-01T00:00:00.000Z",
    }])),
    rights: new Map([
      ["world_bank", allowedRights("world_bank")],
      ["wikidata", allowedRights("wikidata")],
      ["cia_factbook", allowedRights("cia_factbook")],
      ["ipu_parline", blockedRights("ipu_parline")],
    ]),
  });
}

function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') {
      field += '"'; index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { record.push(field); field = ""; }
    else if (char === "\n" && !quoted) {
      record.push(field); records.push(record); record = []; field = "";
    } else field += char;
  }
  return records;
}

test("France population exports one canonical plus separately typed evidence", () => {
  const document = fixture();
  assert.equal(document.facts.length, 1);
  const population = document.facts[0];
  assert.equal(population.canonical.rowId, "fr-wb");
  assert.deepEqual(population.alternates.map((item) => item.rowId), ["fr-wd"]);
  assert.deepEqual(population.projections.map((item) => item.rowId), ["fr-cia-proj"]);
  assert.deepEqual(population.rejected.map((item) => item.rowId), ["fr-wb-rejected"]);
  assert.equal(population.canonical.dispute.openOrInReview, true);
  assert.equal(population.canonical.source.license, "CC-BY-4.0");
  assert.equal(document.withheld.observationCount, 1);
  assert.doesNotMatch(JSON.stringify(document), /fr-restricted|ipu_parline/);
});

test("France population JSON and CSV preserve the same observation semantics", () => {
  const document = fixture();
  const jsonRows = flattenCountryResearchExport(document).map((item) => ({
    rowId: item.rowId,
    recordClass: item.recordClass,
    value: String(item.value.numeric),
    source: item.source.id,
    status: item.lifecycle.status,
  }));
  const csv = parseCsv(countryResearchExportCsv(document));
  const header = csv[0];
  const value = (record: string[], column: string) => record[header.indexOf(column)];
  const csvRows = csv.slice(1).map((record) => ({
    rowId: value(record, "row_id"),
    recordClass: value(record, "record_class"),
    value: value(record, "value_numeric"),
    source: value(record, "source_id"),
    status: value(record, "lifecycle_status"),
  }));
  assert.deepEqual(csvRows, jsonRows);
});

test("a restricted canonical withholds the fact instead of relabeling an alternate", () => {
  const document = fixture();
  const population = document.facts[0];
  const restrictedCanonical: ResolverOutput = {
    ...({} as ResolverOutput),
    jurisdictionId: "france-id",
    factKey: "population_total",
    canonical: row("restricted-canonical", "ipu_parline", 1),
    alternates: [],
    all: [
      row("restricted-canonical", "ipu_parline", 1),
      row("allowed-alternate", "world_bank", 2),
    ],
    isDisputed: false,
    decisionReason: "fresher_winner",
    decisionTrace: [],
    proposedDisputes: [],
    canonicalIsProjection: false,
  };
  const rebuilt = buildCountryResearchExport({
    generatedAt: document.generatedAt,
    selection: document.selection,
    jurisdiction: document.jurisdiction,
    resolutions: { population_total: restrictedCanonical },
    sources: new Map([
      ["ipu_parline", { id: "ipu_parline", name: "IPU", baseUrl: "https://ipu.org", lastSyncAt: null }],
    ]),
    rights: new Map([["ipu_parline", blockedRights("ipu_parline")]]),
  });
  assert.equal(rebuilt.facts.length, 0);
  assert.deepEqual(rebuilt.withheld.factKeys, ["population_total"]);
});
