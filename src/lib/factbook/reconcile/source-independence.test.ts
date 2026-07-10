import assert from "node:assert/strict";
import test from "node:test";
import { countIndependentFamilies, resolveSourceLineage } from "./source-independence";

const families = (
  factKey: string,
  sources: string[],
  jurisdictionIso3?: string,
) =>
  new Set(
    sources.map((sourceId) =>
      resolveSourceLineage({ sourceId, factKey, jurisdictionIso3 }).familyId,
    ),
  );

test("Argentina population collapses World Bank and UN Data into UN WPP", () => {
  assert.equal(
    countIndependentFamilies([
      { sourceId: "world_bank", factKey: "population_total" },
      { sourceId: "un_data", factKey: "population_total" },
    ]),
    1,
  );
});

test("Brazil population keeps IBGE independent from the UN WPP family", () => {
  assert.equal(
    countIndependentFamilies([
      { sourceId: "ibge_br", factKey: "population_total", jurisdictionIso3: "BRA" },
      { sourceId: "world_bank", factKey: "population_total", jurisdictionIso3: "BRA" },
      { sourceId: "un_data", factKey: "population_total", jurisdictionIso3: "BRA" },
    ]),
    2,
  );
});

test("UNDP schooling rows collapse into UNESCO UIS", () => {
  assert.deepEqual(
    families("expected_years_schooling", ["unesco_uis", "undp_hdi"]),
    new Set(["unesco_uis"]),
  );
});

test("World Bank unemployment collapses into ILOSTAT", () => {
  assert.deepEqual(
    families("unemployment_rate_pct", ["world_bank", "ilo_ilostat"]),
    new Set(["ilo_ilostat"]),
  );
});

test("World Bank life expectancy shares the UN health-demography family", () => {
  assert.deepEqual(
    families("life_expectancy_years", ["world_bank", "un_data", "who_gho", "undp_hdi"]),
    new Set(["un_health_demography"]),
  );
});

test("Eurostat and INSEE are one family for a French claim", () => {
  assert.deepEqual(
    families("inflation_rate", ["eurostat", "insee_fr"], "FRA"),
    new Set(["nso:FRA"]),
  );
});

test("IMF and World Bank GDP remain distinct producing families", () => {
  assert.equal(
    countIndependentFamilies([
      { sourceId: "imf_weo", factKey: "gdp_nominal_usd_billions" },
      { sourceId: "world_bank", factKey: "gdp_nominal_usd_billions" },
    ]),
    2,
  );
});

test("CIA and Wikidata compilations do not manufacture two-source independence", () => {
  assert.equal(
    countIndependentFamilies([
      { sourceId: "cia_factbook", factKey: "capital" },
      { sourceId: "wikidata", factKey: "capital" },
    ]),
    1,
  );
});

test("projected rows do not corroborate a measured family", () => {
  assert.equal(
    countIndependentFamilies([
      { sourceId: "un_data", factKey: "population_total", valueType: "measured" },
      { sourceId: "imf_weo", factKey: "population_total", valueType: "projected" },
    ]),
    1,
  );
});

test("unknown lineage fails closed", () => {
  const lineage = resolveSourceLineage({ sourceId: "new_source", factKey: "population_total" });
  assert.equal(lineage.relationship, "unverified");
  assert.equal(lineage.independentEligible, false);
  assert.equal(
    countIndependentFamilies([
      { sourceId: "new_source", factKey: "population_total" },
      { sourceId: "another_new_source", factKey: "population_total" },
    ]),
    1,
  );
});
