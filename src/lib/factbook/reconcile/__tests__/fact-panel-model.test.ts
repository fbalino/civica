import assert from "node:assert/strict";
import test from "node:test";

import { zFactSourcePanel } from "@/lib/api/contract/fact-source-panel";
import {
  buildFactSourcePanel,
  factSourceRefOf,
} from "@/lib/factbook/reconcile/fact-panel-model";
import type { FactRow, ResolverOutput } from "@/lib/factbook/reconcile/types";

function row(partial: Partial<FactRow> & { id: string }): FactRow {
  return {
    jurisdictionId: "4b1f2a13-406c-42c7-9907-23a4906c568d",
    factKey: "population_total",
    factGroup: "B",
    category: "demographics",
    sourceId: "world_bank",
    sourceUrl: "https://data.worldbank.org/indicator/SP.POP.TOTL",
    wikidataQid: null,
    wikidataPid: null,
    wikidataRank: null,
    references: [{ padding: "x".repeat(2000) }],
    factValue: null,
    factValueNumeric: 3_422_794,
    factUnit: null,
    factYear: 2023,
    valueJson: { retained: "x".repeat(2000) },
    asOf: "2023-12-31",
    dataVintageYear: null,
    retrievedAt: "2026-07-01T00:00:00Z",
    upstreamVintageLabel: "WDI 2026Q3",
    methodologyVersion: "v0.3-beta",
    status: "active",
    statusReason: null,
    sourceNote: null,
    valueType: "measured",
    growthMethodology: null,
    ...partial,
  };
}

function output(): ResolverOutput {
  const canonical = row({ id: "row-canonical" });
  const imf = row({
    id: "row-imf",
    sourceId: "imf_weo",
    valueType: "projected",
    factValueNumeric: 3_500_000,
    asOf: "2030-12-31",
    upstreamVintageLabel: "IMF WEO 2026 April",
  });
  const rejected = row({
    id: "row-rejected",
    sourceId: "wikidata",
    status: "rejected",
    statusReason: "Outside the plausibility envelope.",
    factValueNumeric: 34_000_000,
  });
  return {
    jurisdictionId: canonical.jurisdictionId,
    factKey: "population_total",
    canonical,
    alternates: [imf],
    all: [rejected, imf, canonical],
    isDisputed: true,
    decisionReason: "fresher_winner",
    decisionTrace: [
      {
        code: "row_eligibility",
        outcome: "ok",
        detail: "3 rows remained.",
        sourceIds: ["world_bank"],
      },
    ],
    proposedDisputes: [],
    canonicalIsProjection: false,
  };
}

test("the page-level source reference carries no reconciliation rows", () => {
  const ref = factSourceRefOf(output());
  assert.deepEqual(Object.keys(ref).sort(), [
    "canonicalSourceId",
    "canonicalValueNumeric",
    "factKey",
    "isDisputed",
    "jurisdictionId",
  ]);
  assert.equal(ref.canonicalSourceId, "world_bank");
  assert.equal(ref.isDisputed, true);
  assert.ok(JSON.stringify(ref).length < 300);
});

test("the source reference can override the fact key", () => {
  assert.equal(factSourceRefOf(output(), "capital").factKey, "capital");
});

test("the panel document orders and labels every source row", () => {
  const panel = zFactSourcePanel.parse(
    buildFactSourcePanel("population_total", output()),
  );
  assert.deepEqual(
    panel.rows.map((r) => r.id),
    ["row-canonical", "row-imf", "row-rejected"],
  );
  const [canonical, imf, rejected] = panel.rows;
  assert.equal(canonical.isCanonical, true);
  assert.equal(canonical.sourceLabel, "World Bank");
  assert.equal(canonical.value, "3.4M");
  assert.equal(imf.isProjected, true);
  assert.equal(rejected.isRejected, true);
  assert.equal(rejected.statusReason, "Outside the plausibility envelope.");
  assert.equal(panel.canonicalId, "row-canonical");
  assert.equal(panel.isDisputed, true);
  assert.equal(panel.trace[0].code, "row_eligibility");
});

test("the panel document never carries raw source payloads", () => {
  const serialized = JSON.stringify(
    buildFactSourcePanel("population_total", output()),
  );
  assert.equal(serialized.includes("padding"), false);
  assert.equal(serialized.includes("retained"), false);
});

test("the response contract is strict", () => {
  const panel = buildFactSourcePanel("population_total", output());
  assert.equal(
    zFactSourcePanel.safeParse({ ...panel, extra: true }).success,
    false,
  );
  assert.equal(
    zFactSourcePanel.safeParse({ ...panel, schemaVersion: "v0" }).success,
    false,
  );
});
