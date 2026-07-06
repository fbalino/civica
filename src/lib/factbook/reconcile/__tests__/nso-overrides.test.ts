/**
 * NSO-priority-tier patch tests (R.13–R.20).
 *
 * Run with:
 *     npx tsx src/lib/factbook/reconcile/__tests__/nso-overrides.test.ts
 *
 * Tests:
 *   1. isNsoForJurisdiction() — all 8 entries return true/false correctly.
 *   2. NSO row wins a tied-date race against a Tier-1 row for its own country.
 *      (e.g. INSEE 2025 ties Eurostat 2025 for FRA → INSEE wins)
 *   3. A Tier-1 source wins a tied-date race for a country with no registered NSO.
 *      (pre-patch behaviour preserved)
 *   4. Existing worked examples still pass:
 *      - CIA stays at lowest priority (Tier 3) in tiebreaks.
 *      - Wikidata stays at second-lowest priority (Tier 2).
 *      - World Bank wins over Wikidata on a tie (both Tier 1, World Bank direct).
 *
 * Methodology: ~/civica/plan/insee-fr-resolution-v1.md §"Eurostat coexistence handling"
 *              ~/civica/plan/us-census-resolution-v1.md §2d (Option B)
 */
import assert from "node:assert/strict";
import {
  NSO_SOURCE_BY_ISO3,
  isNsoForJurisdiction,
} from "@/lib/factbook/reconcile/nso-overrides";
import { resolveFromRows } from "@/lib/factbook/reconcile/resolver";
import type { FactRow } from "@/lib/factbook/reconcile/types";
import type { FactKeyDefinition } from "@/lib/factbook/reconcile/fact-keys";

// ─────────────────────────────────────────────────────────────────
// Test plumbing (mirrors resolver.test.ts style)
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
function id(): string {
  _idCounter++;
  return `00000000-0000-0000-0001-${String(_idCounter).padStart(12, "0")}`;
}

function row(partial: Partial<FactRow>): FactRow {
  return {
    id: id(),
    jurisdictionId: partial.jurisdictionId ?? "jur-france",
    factKey: partial.factKey ?? "population_total",
    factGroup: partial.factGroup ?? "B",
    category: partial.category ?? "demographics",
    sourceId: partial.sourceId ?? "cia_factbook",
    sourceUrl: partial.sourceUrl ?? null,
    wikidataQid: null,
    wikidataPid: null,
    wikidataRank: null,
    references: null,
    factValue: partial.factValue ?? null,
    factValueNumeric:
      partial.factValueNumeric === undefined ? null : partial.factValueNumeric,
    factUnit: null,
    factYear: partial.factYear ?? null,
    valueJson: null,
    asOf: partial.asOf ?? null,
    dataVintageYear: partial.dataVintageYear ?? null,
    retrievedAt: partial.retrievedAt ?? "2026-04-01T00:00:00Z",
    upstreamVintageLabel: partial.upstreamVintageLabel ?? null,
    methodologyVersion: "v0.1-beta",
    status: partial.status ?? "active",
    statusReason: null,
    sourceNote: null,
    valueType: partial.valueType ?? "measured",
    growthMethodology: partial.growthMethodology ?? null,
  };
}

// Minimal Group B fact-key definition for population (fast-changing, numeric).
const POPULATION_DEF: FactKeyDefinition = {
  key: "population_total",
  group: "B",
  category: "demographics",
  label: "Population",
  envelope: { min: 1_000, max: 2_000_000_000 },
  materialErrorPctThreshold: 0.5,
};

// ─────────────────────────────────────────────────────────────────
// Section 1 — isNsoForJurisdiction() unit tests
// ─────────────────────────────────────────────────────────────────

console.log("NSO overrides tests — R.13–R.20\n");
console.log("1. isNsoForJurisdiction() — all 8 entries\n");

// All 8 registered NSOs should return true for their own country.
const registeredPairs: [string, string][] = Object.entries(NSO_SOURCE_BY_ISO3) as [string, string][];

for (const [iso3, sourceId] of registeredPairs) {
  test(`isNsoForJurisdiction(${sourceId}, ${iso3}) → true`, () => {
    assert.equal(isNsoForJurisdiction(sourceId, iso3), true);
  });
}

// Spot-check: NSO source should NOT match a DIFFERENT country's ISO3.
test("isNsoForJurisdiction(insee_fr, DEU) → false (wrong country)", () => {
  assert.equal(isNsoForJurisdiction("insee_fr", "DEU"), false);
});

test("isNsoForJurisdiction(eurostat, FRA) → false (eurostat is not FRA's NSO)", () => {
  assert.equal(isNsoForJurisdiction("eurostat", "FRA"), false);
});

test("isNsoForJurisdiction(world_bank, USA) → false (not an NSO)", () => {
  assert.equal(isNsoForJurisdiction("world_bank", "USA"), false);
});

// Null/undefined iso3 should always return false.
test("isNsoForJurisdiction(insee_fr, null) → false", () => {
  assert.equal(isNsoForJurisdiction("insee_fr", null), false);
});

test("isNsoForJurisdiction(insee_fr, undefined) → false", () => {
  assert.equal(isNsoForJurisdiction("insee_fr", undefined), false);
});

test("isNsoForJurisdiction(insee_fr, '') → false", () => {
  assert.equal(isNsoForJurisdiction("insee_fr", ""), false);
});

// ─────────────────────────────────────────────────────────────────
// Section 2 — NSO wins tied-date race for own country
// ─────────────────────────────────────────────────────────────────

console.log("\n2. NSO wins tied-date race for own country\n");

test("INSEE 2025 ties Eurostat 2025 for FRA → INSEE wins (Eurozone coexistence fix)", () => {
  // The classic coexistence case: Eurostat republishes INSEE's number
  // within weeks at the same as_of period. Without the patch this was
  // a non-deterministic row-insertion-order race.
  const insee = row({
    sourceId: "insee_fr",
    factValueNumeric: 68_170_228,
    asOf: "2025-01-01",
  });
  const eurostat = row({
    sourceId: "eurostat",
    factValueNumeric: 68_170_228, // same figure, different provenance
    asOf: "2025-01-01", // same date → tied
  });

  // Pass FRA iso3 to activate the NSO tiebreak.
  const out = resolveFromRows([eurostat, insee], POPULATION_DEF, "FRA");

  assert.ok(out.canonical, "expected a canonical row");
  assert.equal(out.canonical!.sourceId, "insee_fr", "INSEE should win the tie");
  assert.equal(
    out.decisionReason,
    "fresher_winner",
    `expected fresher_winner, got ${out.decisionReason}`
  );
  assert.equal(out.alternates.length, 2, "both rows should appear in alternates");
});

test("INSEE 2025 ties Eurostat 2025 for FRA → INSEE wins regardless of array order", () => {
  // Array order should NOT affect the result after the patch.
  const insee = row({
    sourceId: "insee_fr",
    factValueNumeric: 68_170_228,
    asOf: "2025-01-01",
  });
  const eurostat = row({
    sourceId: "eurostat",
    factValueNumeric: 68_170_228,
    asOf: "2025-01-01",
  });

  // Reverse order of the first test.
  const out = resolveFromRows([insee, eurostat], POPULATION_DEF, "FRA");
  assert.ok(out.canonical, "expected a canonical row");
  assert.equal(out.canonical!.sourceId, "insee_fr", "INSEE should win regardless of array order");
});

test("ONS 2025 ties World Bank 2025 for GBR → ONS wins", () => {
  const ons = row({
    sourceId: "ons_uk",
    factValueNumeric: 67_596_000,
    asOf: "2025-06-01",
  });
  const wb = row({
    sourceId: "world_bank",
    factValueNumeric: 67_596_000,
    asOf: "2025-06-01",
  });

  const out = resolveFromRows([wb, ons], POPULATION_DEF, "GBR");
  assert.ok(out.canonical, "expected a canonical row");
  assert.equal(out.canonical!.sourceId, "ons_uk", "ONS should win for GBR");
});

test("us_census 2025 ties World Bank 2025 for USA → us_census wins", () => {
  const usCensus = row({
    sourceId: "us_census",
    factValueNumeric: 334_900_000,
    asOf: "2025-07-01",
  });
  const wb = row({
    sourceId: "world_bank",
    factValueNumeric: 334_900_000,
    asOf: "2025-07-01",
  });

  const out = resolveFromRows([wb, usCensus], POPULATION_DEF, "USA");
  assert.ok(out.canonical, "expected a canonical row");
  assert.equal(out.canonical!.sourceId, "us_census", "us_census should win for USA");
});

// ─────────────────────────────────────────────────────────────────
// Section 3 — NSO does NOT win for a DIFFERENT country
// ─────────────────────────────────────────────────────────────────

console.log("\n3. NSO tiebreak is country-specific (no cross-country leakage)\n");

test("insee_fr tied with eurostat for DEU → eurostat wins (or Tier-1 ordering; insee_fr is NOT DEU's NSO)", () => {
  // Hypothetical: a mistakenly-inserted INSEE row for Germany.
  // INSEE is NOT DEU's NSO, so it should NOT win over Eurostat.
  // Both are Tier 1 for DEU. Array order decides (stable sort,
  // Eurostat appears first → it holds as the initial `prior`).
  const insee = row({
    jurisdictionId: "jur-germany",
    sourceId: "insee_fr",
    factValueNumeric: 84_000_000,
    asOf: "2025-01-01",
  });
  const eurostat = row({
    jurisdictionId: "jur-germany",
    sourceId: "eurostat",
    factValueNumeric: 84_000_000,
    asOf: "2025-01-01",
  });

  // Pass DEU iso3 — insee_fr is NOT DEU's NSO, so Tier 1 vs Tier 1.
  const out = resolveFromRows([eurostat, insee], POPULATION_DEF, "DEU");
  assert.ok(out.canonical, "expected a canonical row");
  // insee_fr should NOT have won over Eurostat for Germany.
  assert.notEqual(
    out.canonical!.sourceId,
    "insee_fr",
    "insee_fr must not win for DEU (it is FRA's NSO, not DEU's)"
  );
});

test("NSO tiebreak with null iso3 → pre-patch 3-tier behaviour", () => {
  // When iso3 is null (non-sovereign territory, or test without iso3),
  // NSO-tier is never assigned → Tier-1 vs Tier-1 → array-order stable.
  const nso = row({
    sourceId: "us_census",
    factValueNumeric: 100_000,
    asOf: "2025-01-01",
  });
  const wb = row({
    sourceId: "world_bank",
    factValueNumeric: 100_000,
    asOf: "2025-01-01",
  });

  // iso3 = null — us_census treated as plain Tier 1, same as world_bank.
  const out = resolveFromRows([wb, nso], POPULATION_DEF, null);
  assert.ok(out.canonical, "expected a canonical row");
  // world_bank is the prior (first in array when no CIA row present),
  // us_census challenges but is same tier → does not unseat it.
  assert.equal(
    out.canonical!.sourceId,
    "world_bank",
    "world_bank should hold as prior when iso3=null (equal Tier-1 tie, prior wins)"
  );
});

// ─────────────────────────────────────────────────────────────────
// Section 4 — Existing priority assertions still hold
// ─────────────────────────────────────────────────────────────────

console.log("\n4. Existing priority assertions still hold\n");

test("CIA stays at lowest priority (Tier 3) for country with NSO", () => {
  // CIA 2024 vs Eurostat 2024 for FRA → Eurostat (Tier 1) wins.
  const cia = row({
    sourceId: "cia_factbook",
    factValueNumeric: 68_000_000,
    asOf: "2024-01-01",
  });
  const eurostat = row({
    sourceId: "eurostat",
    factValueNumeric: 68_100_000,
    asOf: "2024-01-01", // tied date
  });

  const out = resolveFromRows([cia, eurostat], POPULATION_DEF, "FRA");
  assert.ok(out.canonical, "expected a canonical row");
  assert.equal(
    out.canonical!.sourceId,
    "eurostat",
    "Eurostat (Tier 1) should beat CIA (Tier 3) on a tie for FRA"
  );
});

test("CIA stays at lowest priority (Tier 3) for country without NSO", () => {
  // Same test without an iso3 — pre-patch behaviour: Tier-1 beats CIA.
  const cia = row({
    sourceId: "cia_factbook",
    factValueNumeric: 5_000_000,
    asOf: "2024-01-01",
  });
  const wb = row({
    sourceId: "world_bank",
    factValueNumeric: 5_050_000,
    asOf: "2024-01-01",
  });

  const out = resolveFromRows([cia, wb], POPULATION_DEF, null);
  assert.ok(out.canonical, "expected a canonical row");
  assert.equal(
    out.canonical!.sourceId,
    "world_bank",
    "World Bank (Tier 1) should beat CIA (Tier 3) on a tie"
  );
});

test("Wikidata stays at Tier 2 (loses to World Bank on a tie)", () => {
  // World Bank 2024 vs Wikidata 2024 → World Bank wins (Tier 1 vs Tier 2).
  const wb = row({
    sourceId: "world_bank",
    factValueNumeric: 226_683_440,
    asOf: "2024-01-01",
  });
  const wd = row({
    sourceId: "wikidata",
    factValueNumeric: 226_683_440,
    asOf: "2024-01-01",
    wikidataRank: "preferred",
    references: [{ statedInQid: "Q21540096", url: "https://data.worldbank.org/" }],
  });

  // Nigeria — no registered NSO (NGA's NSO is nbs_nigeria, not wikidata or wb).
  const out = resolveFromRows([cia_nigeria(), wb, wd], POPULATION_DEF, "NGA");
  assert.ok(out.canonical, "expected a canonical row");
  // World Bank should win over Wikidata on a tied date.
  assert.equal(
    out.canonical!.sourceId,
    "world_bank",
    "World Bank (Tier 1) should beat Wikidata (Tier 2) on a tied date"
  );
});

test("§12.1 regression — World Bank still wins over Wikidata for Nigeria without iso3", () => {
  // Original §12.1 test: WB is fresher than CIA → fresher_winner.
  // Wikidata has the same date as WB. Both are compared on tie;
  // WB is Tier 1, Wikidata is Tier 2 → WB wins.
  const cia = row({
    sourceId: "cia_factbook",
    factValueNumeric: 230_842_743,
    factYear: 2023,
    asOf: "2023-01-01",
  });
  const wd = row({
    sourceId: "wikidata",
    factValueNumeric: 226_683_440,
    factYear: 2024,
    asOf: "2024-01-01",
    wikidataRank: "preferred",
    references: [{ statedInQid: "Q21540096", url: "https://data.worldbank.org/" }],
  });
  const wb = row({
    sourceId: "world_bank",
    factValueNumeric: 226_683_440,
    factYear: 2024,
    asOf: "2024-01-01",
  });

  // No iso3 (null) — pre-patch behaviour.
  const out = resolveFromRows([cia, wd, wb], POPULATION_DEF, null);
  assert.ok(out.canonical, "expected a canonical row");
  assert.equal(out.canonical!.sourceId, "world_bank", "World Bank should win (§12.1 regression)");
  assert.equal(out.decisionReason, "fresher_winner");
});

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function cia_nigeria(): FactRow {
  return row({
    jurisdictionId: "jur-nigeria",
    sourceId: "cia_factbook",
    factValueNumeric: 230_842_743,
    asOf: "2023-01-01",
  });
}

// ─────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
