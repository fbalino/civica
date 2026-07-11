import assert from "node:assert/strict";
import test from "node:test";
import { parseFactbookNumeric, validateFactNumeric } from "../numeric-validation";

test("microstate-scale values remain valid", () => {
  for (const [key, value] of [
    ["population_total", 50],
    ["population_total", 593],
    ["population_total", 1000],
    ["population_total", 1815],
    ["population_total", 2453],
    ["area_total_km2", 0.44],
    ["gdp_ppp_usd_billions", 0.007711583],
  ] as const) {
    assert.deepEqual(validateFactNumeric(key, value), { accepted: true, reason: null });
  }
});

test("catastrophic and missing numeric candidates fail closed", () => {
  assert.equal(validateFactNumeric("military_expenditure_pct_gdp", 2_010_000_000_000).accepted, false);
  assert.equal(validateFactNumeric("military_expenditure_pct_gdp", null).accepted, false);
});

test("a prose year cannot borrow a later billion scale", () => {
  const prose = "between 2010 and 2020, military expenditures were 20-30% of GDP; spending ranged from $7 billion to $11 billion";
  assert.equal(parseFactbookNumeric(prose, "% of GDP").value, null);
});

test("ordinary leading quantities retain attached scale and year", () => {
  assert.deepEqual(parseFactbookNumeric("$18.7 million (2023 est.)", "$"), {
    value: 18_700_000,
    unit: "$",
    year: 2023,
    note: "(2023 est.)",
  });
  assert.equal(parseFactbookNumeric("2.4% (2024 est.)", "%").value, 2.4);
});
