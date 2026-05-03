/**
 * Sanity tests for `fact-keys.ts`.
 *
 * No test runner is wired into the project (no jest, no vitest). The
 * suite is a runnable script using Node's built-in `assert/strict`.
 * Run via: `npx tsx src/lib/factbook/reconcile/__tests__/fact-keys.test.ts`.
 * Throws on first failure; exits 0 on success.
 */

import assert from "node:assert/strict";
import {
  FACT_KEYS,
  getFactKey,
  getFactKeyCount,
  getFactKeysByGroup,
} from "../fact-keys";

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    throw err;
  }
}

console.log("fact-keys.test.ts");

test("registry has at least 80 fact-keys", () => {
  assert.ok(
    getFactKeyCount() >= 80,
    `expected >= 80 fact-keys, got ${getFactKeyCount()}`,
  );
});

test("getFactKey('population_total') is Group B", () => {
  const def = getFactKey("population_total");
  assert.ok(def, "population_total should be defined");
  assert.equal(def!.group, "B");
  assert.equal(def!.category, "demographics");
  assert.ok(def!.envelope, "population_total should have an envelope");
  assert.equal(def!.envelope!.min, 1_000);
  assert.equal(def!.envelope!.max, 2_000_000_000);
});

test("getFactKey('capital') is Group A identity", () => {
  const def = getFactKey("capital");
  assert.ok(def);
  assert.equal(def!.group, "A");
  assert.equal(def!.category, "identity");
});

test("getFactKey('government_type') is Group C government", () => {
  const def = getFactKey("government_type");
  assert.ok(def);
  assert.equal(def!.group, "C");
  assert.equal(def!.category, "government");
});

test("getFactKey('does_not_exist') returns undefined", () => {
  assert.equal(getFactKey("does_not_exist"), undefined);
});

test("Each group is non-empty", () => {
  assert.ok(getFactKeysByGroup("A").length > 0, "Group A non-empty");
  assert.ok(getFactKeysByGroup("B").length > 0, "Group B non-empty");
  assert.ok(getFactKeysByGroup("C").length > 0, "Group C non-empty");
});

test("Every Group B numeric fact has either pct or pp threshold", () => {
  // Material-error is required for Group B per methodology §3.3
  // Guard 1. Facts with no `envelope` (e.g. text-shaped Group B) are
  // exempt.
  for (const def of getFactKeysByGroup("B")) {
    if (!def.envelope) continue;
    const hasGuard =
      def.materialErrorPctThreshold !== undefined ||
      def.materialErrorPpThreshold !== undefined;
    assert.ok(
      hasGuard,
      `Group B fact '${def.key}' has envelope but no material-error threshold`,
    );
  }
});

test("FACT_KEYS keys equal the def.key strings", () => {
  for (const [k, def] of Object.entries(FACT_KEYS)) {
    assert.equal(k, def.key, `FACT_KEYS['${k}'].key should equal '${k}'`);
  }
});

test("Plausibility envelopes never have inverted bounds", () => {
  for (const def of Object.values(FACT_KEYS)) {
    if (!def.envelope) continue;
    if (def.envelope.min !== undefined && def.envelope.max !== undefined) {
      assert.ok(
        def.envelope.min <= def.envelope.max,
        `Inverted envelope for '${def.key}': min=${def.envelope.min} > max=${def.envelope.max}`,
      );
    }
  }
});

test("Legacy CIA fact_keys are all classified", () => {
  // The 37 keys currently present in country_facts (queried 2026-05-02)
  // must each have a registry entry so the resolver can pick them up
  // without a backfill pass.
  const legacyKeys = [
    "agriculture_products",
    "birth_rate",
    "budget_expenditure",
    "budget_revenue",
    "climate",
    "coastline",
    "death_rate",
    "electricity_access",
    "ethnic_groups",
    "export_commodities",
    "export_partners",
    "exports_total",
    "gdp_growth_rate",
    "gdp_per_capita_ppp",
    "gdp_ppp",
    "import_partners",
    "imports_total",
    "industries",
    "inflation_rate",
    "land_area",
    "languages",
    "life_expectancy",
    "literacy_rate",
    "median_age",
    "military_branches",
    "military_expenditure_pct_gdp",
    "military_service_age",
    "natural_resources",
    "population",
    "population_growth_rate",
    "public_debt_pct_gdp",
    "religions",
    "terrain",
    "total_area",
    "unemployment_rate",
    "urbanization_rate",
    "water_area",
  ];
  for (const key of legacyKeys) {
    assert.ok(
      getFactKey(key),
      `legacy CIA fact_key '${key}' missing from registry`,
    );
  }
});

console.log(`\n  ${passed} test(s) passed.`);
