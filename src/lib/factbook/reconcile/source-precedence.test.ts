import assert from "node:assert/strict";
import test from "node:test";
import { resolveFromRows, SOURCE_PRECEDENCE_VERSION } from "./resolver";
import type { FactKeyDefinition } from "./fact-keys";
import type { FactRow } from "./types";

let counter = 0;
const row = (partial: Partial<FactRow>): FactRow => ({
  id: `precedence-${++counter}`,
  jurisdictionId: "jurisdiction",
  factKey: partial.factKey ?? "population_total",
  factGroup: partial.factGroup ?? "B",
  category: partial.category ?? "demographics",
  sourceId: partial.sourceId ?? "world_bank",
  sourceUrl: partial.sourceUrl ?? "https://example.test/source",
  wikidataQid: null,
  wikidataPid: null,
  wikidataRank: null,
  references: partial.references ?? null,
  factValue: partial.factValue === undefined ? null : partial.factValue,
  factValueNumeric:
    partial.factValueNumeric === undefined ? 1_000_000 : partial.factValueNumeric,
  factUnit: partial.factUnit ?? "people",
  factYear: partial.factYear ?? 2024,
  valueJson: null,
  asOf: partial.asOf ?? "2024-01-01",
  dataVintageYear: partial.dataVintageYear ?? null,
  retrievedAt: partial.retrievedAt ?? "2026-01-01T00:00:00Z",
  upstreamVintageLabel: null,
  methodologyVersion: "v0.1-beta",
  status: partial.status ?? "active",
  statusReason: null,
  sourceNote: null,
  valueType: partial.valueType ?? "measured",
  growthMethodology: partial.growthMethodology ?? null,
});

const population: FactKeyDefinition = {
  key: "population_total",
  group: "B",
  category: "demographics",
  label: "Population",
  envelope: { min: 1_000, max: 2_000_000_000 },
  materialErrorPctThreshold: 0.5,
};

test("measured observations outrank a fresher projection", () => {
  const out = resolveFromRows([
    row({ sourceId: "world_bank", asOf: "2024-01-01", valueType: "measured" }),
    row({ sourceId: "imf_weo", asOf: "2030-01-01", valueType: "projected" }),
  ], population);
  assert.equal(out.canonical?.sourceId, "world_bank");
  assert.equal(out.decisionTrace[1].outcome, "measurements_preferred");
});

test("projections are eligible only as a documented fallback", () => {
  const out = resolveFromRows([
    row({ sourceId: "imf_weo", asOf: "2030-01-01", valueType: "projected" }),
  ], population);
  assert.equal(out.canonicalIsProjection, true);
  assert.equal(out.decisionTrace[1].outcome, "projection_fallback");
});

test("data-vintage year prevents a CIA republication stamp from faking freshness", () => {
  const out = resolveFromRows([
    row({
      sourceId: "cia_factbook",
      asOf: "2026-01-01",
      dataVintageYear: 2023,
      factValueNumeric: 1_000_000,
    }),
    row({
      sourceId: "un_data",
      asOf: "2024-01-01",
      factValueNumeric: 1_010_000,
    }),
  ], population);
  assert.equal(out.canonical?.sourceId, "un_data");
  assert.equal(out.decisionReason, "fresher_winner");
});

test("a native statistical office wins an equal-vintage tie for its country", () => {
  const out = resolveFromRows([
    row({ sourceId: "world_bank", asOf: "2025-01-01" }),
    row({ sourceId: "ibge_br", asOf: "2025-01-01" }),
  ], population, "BRA");
  assert.equal(out.canonical?.sourceId, "ibge_br");
});

test("a direct publisher beats CIA on an equal-vintage Group B tie", () => {
  const out = resolveFromRows([
    row({ sourceId: "cia_factbook", asOf: "2024-01-01" }),
    row({ sourceId: "world_bank", asOf: "2024-01-01" }),
  ], population);
  assert.equal(out.canonical?.sourceId, "world_bank");
});

test("the UN direct-access path beats a downstream republisher regardless of row order", () => {
  const un = row({ sourceId: "un_data", asOf: "2024-01-01" });
  const wb = row({ sourceId: "world_bank", asOf: "2024-01-01" });
  assert.equal(resolveFromRows([wb, un], population).canonical?.sourceId, "un_data");
  assert.equal(resolveFromRows([un, wb], population).canonical?.sourceId, "un_data");
});

test("Group A retains CIA wording and opens review on disagreement", () => {
  const identity: FactKeyDefinition = {
    key: "capital",
    group: "A",
    category: "identity",
    label: "Capital",
  };
  const out = resolveFromRows([
    row({ sourceId: "cia_factbook", factKey: "capital", factGroup: "A", factValue: "A", factValueNumeric: null }),
    row({ sourceId: "world_bank", factKey: "capital", factGroup: "A", factValue: "B", factValueNumeric: null }),
  ], identity);
  assert.equal(out.canonical?.sourceId, "cia_factbook");
  assert.equal(out.decisionReason, "cia_default_group_a");
  assert.equal(out.proposedDisputes[0]?.kind, "group_a_override");
});

test("the decision trace identifies a republisher's producing family", () => {
  const out = resolveFromRows([
    row({ sourceId: "world_bank" }),
  ], population);
  const lineage = out.decisionTrace.find((step) => step.code === "source_lineage");
  assert.equal(lineage?.outcome, "republisher");
  assert.match(lineage?.detail ?? "", /un_wpp/);
});

test("material-error guard retains the incumbent and records the rejection", () => {
  const out = resolveFromRows([
    row({ sourceId: "cia_factbook", asOf: "2023-01-01", factValueNumeric: 1_000_000 }),
    row({ sourceId: "world_bank", asOf: "2024-01-01", factValueNumeric: 2_100_000 }),
  ], population);
  assert.equal(out.canonical?.sourceId, "cia_factbook");
  assert.equal(out.proposedDisputes[0]?.kind, "material_error");
  assert.equal(
    out.decisionTrace.find((step) => step.code === "guard_result")?.outcome,
    "challenger_rejected",
  );
});

test("every canonical trace terminates in a versioned selection", () => {
  const out = resolveFromRows([row({ sourceId: "fao_faostat" })], population);
  const last = out.decisionTrace.at(-1);
  assert.equal(last?.code, "canonical_selection");
  assert.match(last?.detail ?? "", new RegExp(SOURCE_PRECEDENCE_VERSION));
});
