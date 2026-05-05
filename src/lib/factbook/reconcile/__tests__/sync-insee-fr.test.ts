/**
 * Phase R.15 — INSEE FR sync parser tests.
 *
 * Sanity tests for the SDMX-Compact XML parser in
 * `sync-insee-fr.ts`. No DB IO — pure parser unit tests against
 * a live-captured XML fixture (Population idbank `001760077`,
 * verified 2026-05-05).
 *
 * No test runner is wired into the project (no jest, no vitest).
 * The suite is a runnable script using Node's built-in
 * `assert/strict`. Run via:
 *   npx tsx src/lib/factbook/reconcile/__tests__/sync-insee-fr.test.ts
 * Throws on first failure; exits 0 on success.
 */

import assert from "node:assert/strict";
import {
  parseInseeXml,
  latestObs,
  timeperiodToYear,
  applyUnitMult,
  INSEE_INDICATORS,
} from "../sync-insee-fr";

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

console.log("sync-insee-fr.test.ts");

// Live-captured fixture: SDMX-Compact response for INSEE idbank
// 001760077 (Population estimates - All - France entière) on
// 2026-05-05. Trimmed to first 3 observations to keep the fixture
// small.
const POPULATION_FIXTURE = `<?xml version='1.0' encoding='UTF-8'?>
<message:StructureSpecificData xmlns:ss="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/structurespecific" xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message" xmlns:common="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common">
  <message:Header>
    <message:ID>SERIES_BDM_1777952143362</message:ID>
    <message:Prepared>2026-05-05T05:35:43</message:Prepared>
    <message:Sender id="FR1"><common:Name xml:lang="fr">INSEE</common:Name></message:Sender>
  </message:Header>
  <message:DataSet>
    <Series IDBANK="001760077" FREQ="A" TITLE_FR="Estimations de population - Ensemble - France" TITLE_EN="Population estimates - All - France" LAST_UPDATE="2026-01-14" UNIT_MEASURE="INDIVIDUS" UNIT_MULT="0" REF_AREA="FE" DECIMALS="0">
      <Obs TIME_PERIOD="2026" OBS_VALUE="69081996" OBS_STATUS="P" OBS_QUAL="P" OBS_TYPE="A"/>
      <Obs TIME_PERIOD="2025" OBS_VALUE="68851996" OBS_STATUS="P" OBS_REV="1" OBS_QUAL="P" OBS_TYPE="A"/>
      <Obs TIME_PERIOD="2024" OBS_VALUE="68638377" OBS_STATUS="P" OBS_REV="1" OBS_QUAL="P" OBS_TYPE="A"/>
    </Series>
  </message:DataSet>
</message:StructureSpecificData>`;

// Live-captured fixture: SDMX-Compact response for INSEE idbank
// 001688527 (ILO unemployment rate - Total - France hors Mayotte
// - SA) on 2026-05-05. Quarterly cadence with TIME_PERIOD format
// "YYYY-QN" — the lexicographic-order assumption test.
const UNEMPLOYMENT_FIXTURE = `<?xml version='1.0' encoding='UTF-8'?>
<message:StructureSpecificData xmlns:ss="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/structurespecific" xmlns:message="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message" xmlns:common="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common">
  <message:DataSet>
    <Series IDBANK="001688527" FREQ="T" UNIT_MULT="0" SEXE="0" CORRECTION="CVS" UNIT_MEASURE="POURCENT" INDICATEUR="CTTXC" SERIE_ARRETEE="FALSE" REF_AREA="FR-D976" NATURE="TAUX" AGE="00-" TITLE_FR="Taux de chômage au sens du BIT - Ensemble - France hors Mayotte - Données CVS" TITLE_EN="ILO unemployment rate - Total - France excluding Mayotte - SA data" LAST_UPDATE="2026-02-10" DECIMALS="1">
      <Obs TIME_PERIOD="2025-Q4" OBS_VALUE="7.9" OBS_STATUS="A" OBS_QUAL="DEF" OBS_TYPE="A"/>
      <Obs TIME_PERIOD="2025-Q3" OBS_VALUE="7.7" OBS_STATUS="A" OBS_QUAL="DEF" OBS_TYPE="A"/>
      <Obs TIME_PERIOD="2025-Q2" OBS_VALUE="7.6" OBS_STATUS="A" OBS_QUAL="DEF" OBS_TYPE="A"/>
    </Series>
  </message:DataSet>
</message:StructureSpecificData>`;

// SDMX error envelope fixture (404 case).
const ERROR_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<mes:Error xmlns:mes="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message"><mes:ErrorMessage code="100"><com:Text xmlns:com="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common">Aucun résultat ne correspond à cette requête.</com:Text></mes:ErrorMessage></mes:Error>`;

test("INSEE_INDICATORS has exactly 5 entries (R.15 ship scope)", () => {
  assert.equal(INSEE_INDICATORS.length, 5);
});

test("INSEE_INDICATORS all carry civicaRole='canonical'", () => {
  for (const c of INSEE_INDICATORS) {
    assert.equal(c.civicaRole, "canonical", `${c.factKey} should be canonical`);
  }
});

test("INSEE_INDICATORS map to expected 5 fact-keys", () => {
  const factKeys = new Set(INSEE_INDICATORS.map((c) => c.factKey));
  assert.ok(factKeys.has("population_total"));
  assert.ok(factKeys.has("inflation_rate"));
  assert.ok(factKeys.has("unemployment_rate_pct"));
  assert.ok(factKeys.has("gdp_real_growth_rate"));
  assert.ok(factKeys.has("public_debt_pct_gdp"));
});

test("unemployment_rate_pct carries Mayotte sourceNote", () => {
  const u = INSEE_INDICATORS.find((c) => c.factKey === "unemployment_rate_pct");
  assert.ok(u);
  assert.ok(
    u!.sourceNote && u!.sourceNote.includes("hors Mayotte"),
    "unemployment_rate_pct should carry Mayotte caveat in sourceNote",
  );
});

test("parseInseeXml returns one Series for population fixture", () => {
  const parsed = parseInseeXml(POPULATION_FIXTURE);
  assert.equal(parsed.length, 1);
  const s = parsed[0];
  assert.equal(s.idbank, "001760077");
  assert.equal(s.freq, "A");
  assert.equal(s.refArea, "FE");
  assert.equal(s.unitMult, 0);
  assert.equal(s.unitMeasure, "INDIVIDUS");
  assert.equal(s.lastUpdate, "2026-01-14");
  assert.equal(s.titleEn, "Population estimates - All - France");
  assert.equal(s.titleFr, "Estimations de population - Ensemble - France");
});

test("parseInseeXml extracts 3 observations for population fixture", () => {
  const parsed = parseInseeXml(POPULATION_FIXTURE);
  const s = parsed[0];
  assert.equal(s.obs.length, 3);
  // Insertion order matches XML
  assert.equal(s.obs[0].timePeriod, "2026");
  assert.equal(s.obs[0].value, 69081996);
  assert.equal(s.obs[0].obsStatus, "P");
});

test("latestObs picks 2026 over 2025 / 2024 (annual lex-order)", () => {
  const parsed = parseInseeXml(POPULATION_FIXTURE);
  const latest = latestObs(parsed[0].obs);
  assert.ok(latest);
  assert.equal(latest!.timePeriod, "2026");
  assert.equal(latest!.value, 69081996);
});

test("latestObs picks 2025-Q4 over Q3 / Q2 (quarterly lex-order)", () => {
  const parsed = parseInseeXml(UNEMPLOYMENT_FIXTURE);
  const latest = latestObs(parsed[0].obs);
  assert.ok(latest);
  assert.equal(latest!.timePeriod, "2025-Q4");
  assert.equal(latest!.value, 7.9);
});

test("timeperiodToYear handles annual / quarterly / monthly forms", () => {
  assert.equal(timeperiodToYear("2026"), 2026);
  assert.equal(timeperiodToYear("2025-Q4"), 2025);
  assert.equal(timeperiodToYear("2025-12"), 2025);
  assert.equal(timeperiodToYear("garbage"), null);
});

test("applyUnitMult is identity for UNIT_MULT=0", () => {
  assert.equal(applyUnitMult(69081996, 0), 69081996);
});

test("applyUnitMult scales correctly for UNIT_MULT=3 (thousands)", () => {
  assert.equal(applyUnitMult(68736, 3), 68736000);
});

test("applyUnitMult scales correctly for UNIT_MULT=6 (millions)", () => {
  assert.equal(applyUnitMult(2.5, 6), 2_500_000);
});

test("applyUnitMult scales correctly for UNIT_MULT=9 (billions)", () => {
  assert.equal(applyUnitMult(2.5, 9), 2_500_000_000);
});

test("parseInseeXml handles SDMX error envelope without crashing", () => {
  // The parser should return an empty array for a pure-error
  // response (no <Series> blocks). The fetcher layer separately
  // detects mes:Error and throws — but the pure parser should be
  // crash-free on adversarial input.
  const parsed = parseInseeXml(ERROR_FIXTURE);
  assert.equal(parsed.length, 0);
});

test("REF_AREA=FE for 4 indicators; FR-D976 only for unemployment (resolution §2c)", () => {
  // Spot-check the indicator config — verifies that the
  // resolution's per-indicator REF_AREA decision is reflected in
  // the idbanks chosen. (We don't probe the live API in tests; we
  // verify config-level shape.)
  const u = INSEE_INDICATORS.find((c) => c.factKey === "unemployment_rate_pct");
  assert.ok(u);
  // 001688527 is the FR-D976 (France hors Mayotte) idbank per
  // §2b mapping table.
  assert.equal(u!.idbank, "001688527");

  const p = INSEE_INDICATORS.find((c) => c.factKey === "population_total");
  assert.ok(p);
  // 001760077 is the FE (France entière) idbank per §2b.
  assert.equal(p!.idbank, "001760077");
});

console.log(`\n${passed} test${passed === 1 ? "" : "s"} passed`);
