/**
 * Resolver tests — methodology §12 worked examples.
 *
 * Run with:
 *     npx tsx src/lib/factbook/reconcile/__tests__/resolver.test.ts
 *
 * Targets the pure `resolveFromRows()` function so no DB is required.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §12
 */
import assert from "node:assert/strict";
import { resolveFromRows } from "@/lib/factbook/reconcile/resolver";
import type {
  FactRow,
  ResolverOutput,
} from "@/lib/factbook/reconcile/types";
import type { FactKeyDefinition } from "@/lib/factbook/reconcile/fact-keys";

// ────────────────────────────────────────────────────────────────
// Test plumbing
// ────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  pass  ${name}`);
    pass++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log("    ", (err as Error).message);
    fail++;
  }
}

// ────────────────────────────────────────────────────────────────
// Fixture helpers
// ────────────────────────────────────────────────────────────────

let _idCounter = 0;
function id(): string {
  _idCounter++;
  return `00000000-0000-0000-0000-${String(_idCounter).padStart(12, "0")}`;
}

function row(partial: Partial<FactRow>): FactRow {
  return {
    id: id(),
    jurisdictionId: "jur-nigeria",
    factKey: partial.factKey ?? "population",
    factGroup: partial.factGroup ?? "B",
    category: partial.category ?? "people",
    sourceId: partial.sourceId ?? "cia_factbook",
    sourceUrl: partial.sourceUrl ?? null,
    wikidataQid: partial.wikidataQid ?? null,
    wikidataPid: partial.wikidataPid ?? null,
    wikidataRank: partial.wikidataRank ?? null,
    references: partial.references ?? null,
    factValue: partial.factValue ?? null,
    factValueNumeric:
      partial.factValueNumeric === undefined ? null : partial.factValueNumeric,
    factUnit: partial.factUnit ?? null,
    factYear: partial.factYear ?? null,
    valueJson: partial.valueJson ?? null,
    asOf: partial.asOf ?? null,
    dataVintageYear: partial.dataVintageYear ?? null,
    retrievedAt: partial.retrievedAt ?? "2026-04-01T00:00:00Z",
    upstreamVintageLabel: partial.upstreamVintageLabel ?? null,
    methodologyVersion: partial.methodologyVersion ?? "v0.1-beta",
    status: partial.status ?? "active",
    statusReason: partial.statusReason ?? null,
    sourceNote: partial.sourceNote ?? null,
    valueType: partial.valueType ?? "measured",
    growthMethodology: partial.growthMethodology ?? null,
  };
}

// Local `FactKeyDefinition` fixtures. Mirror the parallel agent's
// expected shape; if their actual interface diverges, only these
// objects need updating.

const POPULATION_DEF: FactKeyDefinition = {
  key: "population",
  group: "B",
  category: "demographics",
  label: "Population",
  envelope: { min: 1_000, max: 2_000_000_000 },
  materialErrorPctThreshold: 0.5, // 50%
};

const GDP_NOMINAL_DEF: FactKeyDefinition = {
  key: "gdp_nominal_usd",
  group: "B",
  category: "economy",
  label: "GDP (nominal)",
  envelope: { min: 0, max: 1e14 },
  materialErrorPctThreshold: 0.8, // 80%
};

const GROWTH_DEF: FactKeyDefinition = {
  key: "gdp_real_growth_rate",
  group: "B",
  category: "economy",
  label: "Real GDP growth rate",
  envelope: { min: -50, max: 50, isPercent: true },
  materialErrorPpThreshold: 50,
};

const CAPITAL_DEF: FactKeyDefinition = {
  key: "capital",
  group: "A",
  category: "identity",
  label: "Capital",
};

const LANGUAGES_DEF: FactKeyDefinition = {
  key: "official_languages",
  group: "A",
  category: "identity",
  label: "Official languages",
};

const RELIGION_DEF: FactKeyDefinition = {
  key: "religion_breakdown",
  group: "C",
  category: "society",
  label: "Religion breakdown",
};

// ────────────────────────────────────────────────────────────────
// Worked-example tests — methodology §12
// ────────────────────────────────────────────────────────────────

console.log("Resolver tests — methodology §12 worked examples\n");

test("§12.1 Nigeria population — World Bank wins (fresher_winner)", () => {
  const cia = row({
    factKey: "population",
    factGroup: "B",
    sourceId: "cia_factbook",
    factValueNumeric: 230_842_743,
    factValue: "230,842,743",
    factYear: 2023,
    asOf: "2023-01-01",
  });
  const wd = row({
    factKey: "population",
    factGroup: "B",
    sourceId: "wikidata",
    factValueNumeric: 226_683_440,
    factYear: 2024,
    asOf: "2024-01-01",
    wikidataQid: "Q1033",
    wikidataPid: "P1082",
    wikidataRank: "preferred",
    references: [{ statedInQid: "Q21540096", url: "https://data.worldbank.org/" }],
  });
  const wb = row({
    factKey: "population",
    factGroup: "B",
    sourceId: "world_bank",
    factValueNumeric: 226_683_440,
    factYear: 2024,
    asOf: "2024-01-01",
  });
  const out = resolveFromRows([cia, wd, wb], POPULATION_DEF);
  assertWinner(out, wb.id, "fresher_winner");
  // Both CIA and Wikidata are alternates.
  assert.equal(out.alternates.length, 3);
  assert.equal(out.proposedDisputes.length, 0);
});

test("§12.2 Nigeria capital — agreement (CIA preferred)", () => {
  const cia = row({
    factKey: "capital",
    factGroup: "A",
    sourceId: "cia_factbook",
    factValue: "Abuja",
  });
  const wd = row({
    factKey: "capital",
    factGroup: "A",
    sourceId: "wikidata",
    factValue: "Abuja",
    wikidataRank: "preferred",
    references: [{ statedInQid: "Q21540096", url: "https://nigeria.gov.ng/" }],
  });
  const out = resolveFromRows([cia, wd], CAPITAL_DEF);
  assertWinner(out, cia.id, "agreement");
  assert.equal(out.proposedDisputes.length, 0);
});

test("§12.3 Nigeria official languages — CIA wins, dispute proposed", () => {
  const cia = row({
    factKey: "official_languages",
    factGroup: "A",
    sourceId: "cia_factbook",
    factValue: "English (official)",
  });
  const wd = row({
    factKey: "official_languages",
    factGroup: "A",
    sourceId: "wikidata",
    factValue: "English",
    wikidataRank: "preferred",
    // Wikisource is NOT on the allowlist.
    references: [
      { url: "https://en.wikisource.org/wiki/Constitution_of_Nigeria" },
    ],
  });
  const out = resolveFromRows([cia, wd], LANGUAGES_DEF);
  assertWinner(out, cia.id, "cia_default_group_a");
  assert.equal(out.proposedDisputes.length, 1);
  assert.equal(out.proposedDisputes[0].kind, "group_a_override");
});

test("§12.4 Nigeria GDP material-error — CIA stays, candidate rejected", () => {
  const cia = row({
    factKey: "gdp_nominal_usd",
    factGroup: "B",
    sourceId: "cia_factbook",
    factValueNumeric: 440_000_000_000,
    factYear: 2024,
    asOf: "2024-01-01",
  });
  const wd = row({
    factKey: "gdp_nominal_usd",
    factGroup: "B",
    sourceId: "wikidata",
    factValueNumeric: 4_400_000_000_000, // 10x corruption
    factYear: 2024,
    asOf: "2024-06-01",
    wikidataRank: "preferred",
    references: [{ statedInQid: "Q21540096" }],
  });
  const out = resolveFromRows([cia, wd], GDP_NOMINAL_DEF);
  // 2 active rows enter the resolver; WD is rejected during the
  // pass for material-error, CIA holds. Per the resolver's
  // post-2026-05-02 decision-reason refinement, that's
  // `incumbent_held`, not `single_source` — the latter is
  // reserved for the case where `active.length === 1` from the
  // start. The semantic difference matters for the alternate-
  // values panel ("CIA held vs Wikidata's rejected claim" vs
  // "CIA is the only source").
  assertWinner(out, cia.id, "incumbent_held");
  const matErr = out.proposedDisputes.find((d) => d.kind === "material_error");
  assert.ok(matErr, "expected a material_error dispute");
  assert.equal(matErr!.factIdA, cia.id);
  assert.equal(matErr!.factIdB, wd.id);
});

test("§12.5 Vatican religion breakdown — CIA wins, group_c dispute", () => {
  const cia = row({
    jurisdictionId: "jur-vatican",
    factKey: "religion_breakdown",
    factGroup: "C",
    sourceId: "cia_factbook",
    factValue: "Roman Catholic 100%",
  });
  const wd = row({
    jurisdictionId: "jur-vatican",
    factKey: "religion_breakdown",
    factGroup: "C",
    sourceId: "wikidata",
    factValue: "Catholic 99%, Other 1%",
    wikidataRank: "preferred",
  });
  const out = resolveFromRows([cia, wd], RELIGION_DEF);
  assertWinner(out, cia.id, "cia_default_group_c");
  const groupC = out.proposedDisputes.find((d) => d.kind === "group_c_override");
  assert.ok(groupC, "expected a group_c_override dispute");
});

test("Single-source case — only one row, that row wins", () => {
  const only = row({
    factKey: "population",
    factGroup: "B",
    sourceId: "cia_factbook",
    factValueNumeric: 100_000_000,
    factYear: 2024,
    asOf: "2024-01-01",
  });
  const out = resolveFromRows([only], POPULATION_DEF);
  assertWinner(out, only.id, "single_source");
  assert.equal(out.proposedDisputes.length, 0);
});

// ────────────────────────────────────────────────────────────────
// data_vintage_year — CIA-stale-vintage correction (Option A).
// ~/civica/plan/cia-stale-vintage-resolution-v1.md
// ────────────────────────────────────────────────────────────────

test("data_vintage_year — CIA's projection stamp loses to a fresher primary measurement", () => {
  // Anchor case shape (USA population_total): CIA carries a 2025 est.
  // stamp but its measurement vintage is 2024; the primary publisher's
  // real 2024 measurement should win once dataVintageYear ages CIA down.
  const cia = row({
    factKey: "population_total",
    factGroup: "B",
    sourceId: "cia_factbook",
    factValueNumeric: 338_016_260,
    factYear: 2025,
    asOf: "2025-01-01",
    dataVintageYear: 2024, // real measurement vintage, stamp untouched
  });
  const primary = row({
    factKey: "population_total",
    factGroup: "B",
    sourceId: "world_bank",
    factValueNumeric: 340_110_980,
    factYear: 2024,
    asOf: "2024-01-01",
  });
  const out = resolveFromRows([cia, primary], POPULATION_DEF);
  // Primary wins: with dataVintageYear=2024, CIA is no longer strictly
  // fresher than the 2024 primary, and CIA is Tier 3 on the tiebreak.
  assertWinner(out, primary.id, "fresher_winner");
  // CIA's original stamp is untouched — the correction lives only in
  // dataVintageYear.
  const ciaAlt = out.alternates.find((r) => r.sourceId === "cia_factbook");
  assert.equal(ciaAlt?.factYear, 2025);
  assert.equal(ciaAlt?.dataVintageYear, 2024);
});

test("data_vintage_year — null vintage falls back to the stamp ladder (CIA still wins on a fresher stamp)", () => {
  // Control: with NO dataVintageYear, the pre-correction behaviour holds —
  // CIA's fresher 2025 stamp beats the 2024 primary. Proves the column,
  // not a resolver special-case, drives the flip.
  const cia = row({
    factKey: "population_total",
    factGroup: "B",
    sourceId: "cia_factbook",
    factValueNumeric: 338_016_260,
    factYear: 2025,
    asOf: "2025-01-01",
    // dataVintageYear left null
  });
  const primary = row({
    factKey: "population_total",
    factGroup: "B",
    sourceId: "world_bank",
    factValueNumeric: 340_110_980,
    factYear: 2024,
    asOf: "2024-01-01",
  });
  const out = resolveFromRows([cia, primary], POPULATION_DEF);
  assertWinner(out, cia.id, "incumbent_held");
});

// ────────────────────────────────────────────────────────────────
// Q3 — growth-methodology comparability rule (fact-key-scoped).
// ~/civica/plan/gdp-growth-methodology-mix-resolution-v1.md
// ────────────────────────────────────────────────────────────────

test("Q3 growth — non-YoY winner exactly 12 months fresher yields to annual_yoy (Brazil shape)", () => {
  // IBGE reports four-quarter accumulated (as_of 2025-01-01); World Bank
  // reports annual YoY (as_of 2024-01-01). The gap is exactly 12 calendar
  // months — NOT more than 12 — so the comparable annual-YoY publisher wins.
  const ibge = row({
    factKey: "gdp_real_growth_rate",
    factGroup: "B",
    sourceId: "ibge_br",
    factValueNumeric: 2.3,
    factYear: 2025,
    asOf: "2025-01-01",
    growthMethodology: "four_quarter_accumulated_yoy",
  });
  const wb = row({
    factKey: "gdp_real_growth_rate",
    factGroup: "B",
    sourceId: "world_bank",
    factValueNumeric: 3.42,
    factYear: 2024,
    asOf: "2024-01-01",
    growthMethodology: "annual_yoy",
  });
  const out = resolveFromRows([ibge, wb], GROWTH_DEF);
  assertWinner(out, wb.id, "fresher_winner");
});

test("Q3 growth — non-YoY winner MORE than 12 months fresher is kept (South Africa shape)", () => {
  // Stats SA reports QoQ SA (as_of 2025-12-31); World Bank reports annual
  // YoY (as_of 2024-01-01). Stats SA is ~2 years fresher (> 12 months), so
  // the specialised publisher keeps the canonical pick.
  const statsSa = row({
    factKey: "gdp_real_growth_rate",
    factGroup: "B",
    sourceId: "stats_sa",
    factValueNumeric: 0.4,
    factYear: 2025,
    asOf: "2025-12-31",
    growthMethodology: "qoq_seasonally_adjusted",
  });
  const wb = row({
    factKey: "gdp_real_growth_rate",
    factGroup: "B",
    sourceId: "world_bank",
    factValueNumeric: 0.53,
    factYear: 2024,
    asOf: "2024-01-01",
    growthMethodology: "annual_yoy",
  });
  const out = resolveFromRows([statsSa, wb], GROWTH_DEF);
  assertWinner(out, statsSa.id, "incumbent_held");
});

test("Q3 growth — no methodology mix (all annual_yoy) leaves freshness pick untouched (Germany shape)", () => {
  // Eurostat + World Bank both annual YoY; the rule requires a mix, so the
  // freshest (Eurostat) wins purely on freshness — no growth adjustment.
  const eurostat = row({
    factKey: "gdp_real_growth_rate",
    factGroup: "B",
    sourceId: "eurostat",
    factValueNumeric: 0.2,
    factYear: 2025,
    asOf: "2025-01-01",
    growthMethodology: "annual_yoy",
  });
  const wb = row({
    factKey: "gdp_real_growth_rate",
    factGroup: "B",
    sourceId: "world_bank",
    factValueNumeric: -0.5,
    factYear: 2024,
    asOf: "2024-01-01",
    growthMethodology: "annual_yoy",
  });
  const out = resolveFromRows([eurostat, wb], GROWTH_DEF);
  assertWinner(out, eurostat.id, "incumbent_held");
});

test("Q3 growth — rule does NOT apply to non-growth fact-keys", () => {
  // Same freshness shape as the Brazil case but on population_total: the
  // growth adjustment must not fire, so the fresher row wins normally.
  const fresh = row({
    factKey: "population_total",
    factGroup: "B",
    sourceId: "ibge_br",
    factValueNumeric: 203_000_000,
    factYear: 2025,
    asOf: "2025-01-01",
    growthMethodology: "four_quarter_accumulated_yoy", // ignored off-growth
  });
  const older = row({
    factKey: "population_total",
    factGroup: "B",
    sourceId: "world_bank",
    factValueNumeric: 216_000_000,
    factYear: 2024,
    asOf: "2024-01-01",
    growthMethodology: "annual_yoy",
  });
  const out = resolveFromRows([fresh, older], POPULATION_DEF);
  // Fresher row wins (rule is fact-key-scoped and never fires here).
  assertWinner(out, fresh.id, "incumbent_held");
});

test("No active rows — canonical=null, decisionReason=no_active_rows", () => {
  const out = resolveFromRows([], POPULATION_DEF);
  assert.equal(out.canonical, null);
  assert.equal(out.decisionReason, "no_active_rows");
  assert.equal(out.alternates.length, 0);
  assert.equal(out.all.length, 0);
});

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function assertWinner(
  out: Omit<ResolverOutput, "jurisdictionId" | "factKey" | "isDisputed">,
  expectedId: string,
  expectedReason: ResolverOutput["decisionReason"]
): void {
  assert.ok(out.canonical, "expected a canonical row");
  assert.equal(out.canonical!.id, expectedId, "wrong canonical winner");
  assert.equal(
    out.decisionReason,
    expectedReason,
    `wrong decisionReason (got ${out.decisionReason})`
  );
  // alternates[0] should be the canonical.
  assert.equal(out.alternates[0]?.id, expectedId);
}

// ────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
