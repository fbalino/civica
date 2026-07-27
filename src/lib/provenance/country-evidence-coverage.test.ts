import assert from "node:assert/strict";
import test from "node:test";

import type { FactRow, ResolverOutput } from "@/lib/factbook/reconcile/types";
import { buildCountryEvidenceCoverage } from "./country-evidence-coverage";

function row(
  id: string,
  sourceId: string,
  valueType: "measured" | "projected" = "measured",
): FactRow {
  return {
    id,
    jurisdictionId: "j1",
    factKey: "fixture",
    factGroup: "B",
    category: "fixture",
    sourceId,
    sourceUrl: null,
    wikidataQid: null,
    wikidataPid: null,
    wikidataRank: null,
    references: null,
    factValue: "1",
    factValueNumeric: 1,
    factUnit: null,
    factYear: 2025,
    valueJson: null,
    valueStatus: "observed",
    valueStatusReason: null,
    asOf: "2025-01-01",
    dataVintageYear: 2025,
    retrievedAt: "2026-07-12T00:00:00.000Z",
    upstreamVintageLabel: "fixture",
    methodologyVersion: "fixture",
    status: "active",
    statusReason: null,
    sourceNote: null,
    valueType,
    growthMethodology: null,
  };
}

function output(
  key: string,
  rows: FactRow[],
  decisionReason: ResolverOutput["decisionReason"],
): ResolverOutput {
  return {
    jurisdictionId: "j1",
    factKey: key,
    canonical: rows[0] ?? null,
    alternates: rows,
    all: rows,
    isDisputed: false,
    decisionReason,
    decisionTrace: [],
    proposedDisputes: [],
    canonicalIsProjection: rows[0]?.valueType === "projected",
  };
}

const coverage = {
  id: "fixture",
  label: "Fixture",
  facts: 80,
  sourceLinkedFacts: 79,
  oneSourceFacts: 60,
  twoPlusIndependentSourceFacts: 4,
  unresolvedDisputes: 2,
  staleRows: 3,
};

test("coverage and missingness remain evidence properties with exact denominators", () => {
  const result = buildCountryEvidenceCoverage({
    coverageSnapshotAt: "2026-07-11T00:00:00.000Z",
    coverage,
    registeredFactKeys: 129,
    resolverFacts: {},
  });
  assert.equal(result.coverage.heldFactKeyGroups, 80);
  assert.equal(result.coverage.noActiveFactGroup, 49);
  assert.equal(result.coverage.sourceLinkedFactGroups, 79);
  assert.equal(result.coverage.staleLiveRows, 3);
});

test("agreement excludes a lone measurement plus a projection", () => {
  const result = buildCountryEvidenceCoverage({
    coverageSnapshotAt: "2026-07-11T00:00:00.000Z",
    coverage,
    registeredFactKeys: 129,
    resolverFacts: {
      agreement: output(
        "agreement",
        [row("a", "world_bank"), row("b", "imf_weo")],
        "agreement",
      ),
      difference: output(
        "difference",
        [row("c", "world_bank"), row("d", "imf_weo")],
        "fresher_winner",
      ),
      projection: output(
        "projection",
        [row("e", "world_bank"), row("f", "imf_weo", "projected")],
        "single_source",
      ),
    },
  });
  assert.equal(result.resolver.withinToleranceAgreement, 1);
  assert.equal(result.resolver.resolverSelectedDifference, 1);
  assert.equal(result.resolver.multiSourceFactGroups, 2);
});

test("resolver outage stays explicit while checked coverage remains usable", () => {
  const result = buildCountryEvidenceCoverage({
    coverageSnapshotAt: "2026-07-11T00:00:00.000Z",
    coverage,
    registeredFactKeys: 129,
    resolverFacts: null,
  });
  assert.equal(result.resolver.available, false);
  assert.equal(result.resolver.withinToleranceAgreement, null);
  assert.equal(result.coverage.heldFactKeyGroups, 80);
});

test("registered-key drift fails instead of truncating missingness to zero", () => {
  assert.throws(
    () =>
      buildCountryEvidenceCoverage({
        coverageSnapshotAt: "2026-07-11T00:00:00.000Z",
        coverage,
        registeredFactKeys: 79,
        resolverFacts: {},
      }),
    /exceed the registered fact-key set/,
  );
});
