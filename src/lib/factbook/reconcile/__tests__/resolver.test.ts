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
    retrievedAt: partial.retrievedAt ?? "2026-04-01T00:00:00Z",
    upstreamVintageLabel: partial.upstreamVintageLabel ?? null,
    methodologyVersion: partial.methodologyVersion ?? "v0.1-beta",
    status: partial.status ?? "active",
    statusReason: partial.statusReason ?? null,
    sourceNote: partial.sourceNote ?? null,
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
