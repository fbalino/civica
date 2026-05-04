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
  //
  // Phase R.7.5 (2026-05-04) note: the legacy `taxes_revenues_pct_gdp`
  // declaration was removed because no sync ever wrote rows to it
  // (verified 0 rows in `country_facts`). It is intentionally NOT in
  // this list. The new OECD-canonical `tax_revenue_pct_gdp` replaces
  // it. See `~/civica/plan/fact-key-registry-expansion-resolution-v1.md`.
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

test("R.7.5 — vestigial taxes_revenues_pct_gdp is removed", () => {
  // Per `~/civica/plan/fact-key-registry-expansion-resolution-v1.md`
  // §7 Q1 sign-off (Option B: remove). The OECD-harmonized
  // `tax_revenue_pct_gdp` replaces it.
  assert.equal(
    getFactKey("taxes_revenues_pct_gdp"),
    undefined,
    "taxes_revenues_pct_gdp should be removed; tax_revenue_pct_gdp replaces it",
  );
});

test("R.7.5 — 12 new fact-keys are declared with valid envelopes", () => {
  // Per `~/civica/plan/fact-key-registry-expansion-resolution-v1.md`
  // §2 + Appendix A. Each fact-key must (a) be present, (b) be Group B,
  // (c) have an envelope, (d) have a material-error threshold.
  const newKeys = [
    "healthy_life_expectancy_years",
    "maternal_mortality_per_100000",
    "under_five_mortality_per_1000",
    "ncd_premature_mortality_pct",
    "health_expenditure_pct_gdp",
    "government_education_expenditure_pct_gdp",
    "gross_enrollment_ratio_primary_pct",
    "gross_enrollment_ratio_secondary_pct",
    "completion_rate_primary_pct",
    "gender_parity_index_literacy",
    "gerd_pct_gdp",
    "tax_revenue_pct_gdp",
  ];
  for (const key of newKeys) {
    const def = getFactKey(key);
    assert.ok(def, `R.7.5 fact-key '${key}' missing from registry`);
    assert.equal(def!.group, "B", `R.7.5 fact-key '${key}' should be Group B`);
    assert.ok(def!.envelope, `R.7.5 fact-key '${key}' missing envelope`);
    const hasGuard =
      def!.materialErrorPctThreshold !== undefined ||
      def!.materialErrorPpThreshold !== undefined;
    assert.ok(hasGuard, `R.7.5 fact-key '${key}' missing material-error threshold`);
  }
});

test("R.7.5 — health_expenditure_pct_gdp envelope matches probe range", () => {
  // Probe (2022): WHO range 1.8-23.1%, OECD range 2.7-16.5%.
  // Envelope [0, 30] is the proposed methodology decision.
  const def = getFactKey("health_expenditure_pct_gdp");
  assert.ok(def);
  assert.equal(def!.envelope!.min, 0);
  assert.equal(def!.envelope!.max, 30);
  assert.equal(def!.envelope!.isPercent, false);
  assert.equal(def!.higherIsBetter, undefined,
    "health_expenditure_pct_gdp higherIsBetter should be undefined per §7 Q6");
  assert.equal(def!.materialErrorPpThreshold, 2);
});

test("R.7.5 — gender_parity_index_literacy higherIsBetter is undefined", () => {
  // Per §7 Q5 sign-off — closer to 1 is better, both directions
  // (>1 and <1) indicate disparity. Not representable as
  // higherIsBetter.
  const def = getFactKey("gender_parity_index_literacy");
  assert.ok(def);
  assert.equal(def!.higherIsBetter, undefined);
});

test("R.7.5 — GER fact-keys allow values >100 (over-age enrollment)", () => {
  // Gross enrollment ratios routinely exceed 100% because over-age
  // and under-age children get enrolled in primary. Envelope max
  // 200 (NOT 100, NOT isPercent: true).
  const primary = getFactKey("gross_enrollment_ratio_primary_pct");
  const secondary = getFactKey("gross_enrollment_ratio_secondary_pct");
  for (const def of [primary, secondary]) {
    assert.ok(def);
    assert.equal(def!.envelope!.max, 200);
    assert.equal(def!.envelope!.isPercent, false,
      "GER envelope must NOT be isPercent: true (would clamp to 101)");
  }
});

console.log(`\n  ${passed} test(s) passed.`);
