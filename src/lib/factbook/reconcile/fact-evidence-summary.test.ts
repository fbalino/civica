import assert from "node:assert/strict";
import test from "node:test";

import type { FactRow, ResolverOutput } from "./types";
import { buildFactEvidenceSummary } from "./fact-evidence-summary";

function row(id: string, sourceId: string): FactRow {
  return {
    id,
    jurisdictionId: "j1",
    factKey: "population_total",
    factGroup: "B",
    category: "people",
    sourceId,
    sourceUrl: null,
    wikidataQid: null,
    wikidataPid: null,
    wikidataRank: null,
    references: null,
    factValue: "100",
    factValueNumeric: 100,
    factUnit: "people",
    factYear: 2025,
    valueJson: null,
    valueStatus: "observed",
    valueStatusReason: null,
    asOf: "2025-01-01",
    dataVintageYear: 2025,
    retrievedAt: "2026-07-12T00:00:00.000Z",
    upstreamVintageLabel: "2025",
    methodologyVersion: "fixture",
    status: "active",
    statusReason: null,
    sourceNote: null,
    valueType: "measured",
    growthMethodology: null,
  };
}

function output(rows: FactRow[], decisionReason: ResolverOutput["decisionReason"]): ResolverOutput {
  return {
    jurisdictionId: "j1",
    factKey: "population_total",
    canonical: rows[0] ?? null,
    alternates: rows,
    all: rows,
    isDisputed: false,
    decisionReason,
    decisionTrace: [
      {
        code: "precedence_rule",
        outcome: decisionReason,
        detail: "Fixture precedence rationale.",
        sourceIds: rows.map((item) => item.sourceId),
      },
    ],
    proposedDisputes: [],
    canonicalIsProjection: false,
  };
}

test("one eligible source is labelled plainly without an agreement claim", () => {
  const summary = buildFactEvidenceSummary(output([row("a", "world_bank")], "single_source"));
  assert.equal(summary.posture, "single_source");
  assert.match(summary.explanation, /no source-agreement claim/);
});

test("republishers sharing UN WPP count as one producing family", () => {
  const summary = buildFactEvidenceSummary(
    output([row("a", "world_bank"), row("b", "un_data")], "agreement"),
  );
  assert.equal(summary.posture, "agreement");
  assert.equal(summary.sourceRecordCount, 2);
  assert.equal(summary.verifiedFamilyCount, 1);
  assert.match(summary.explanation, /not counted as independent corroboration/);
});

test("disagreement reports deterministic selection rather than a source vote", () => {
  const summary = buildFactEvidenceSummary(
    output([row("a", "world_bank"), row("b", "imf_weo")], "fresher_winner"),
  );
  assert.equal(summary.posture, "resolver_selected");
  assert.match(summary.explanation, /not a vote/);
  assert.equal(summary.rationale, "Fixture precedence rationale.");
});

