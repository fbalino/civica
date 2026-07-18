import assert from "node:assert/strict";
import test from "node:test";
import type { Country } from "@/components/atlas/data";
import {
  ATLAS_LAYER_KEYS,
  DEFAULT_LAYER,
  NO_DATA_FILL,
  NO_DATA_LABEL,
  fillForLayer,
  legendFor,
  parseLayerParam,
  tooltipValueForLayer,
} from "./map-layers";

const country = { id: "test", name: "Test country" } as Country;

test("ATL-015 map exposes only source-native variables", () => {
  assert.deepEqual(ATLAS_LAYER_KEYS, ["regime", "income"]);
  assert.equal(DEFAULT_LAYER, "regime");
  assert.equal(parseLayerParam("government"), "regime");
  assert.equal(parseLayerParam("ci"), "regime");
  assert.equal(parseLayerParam("pulse"), "regime");
  assert.equal(parseLayerParam("income"), "income");
});

test("ATL-015 map and table share source-native values and explicit missingness", () => {
  const values = {
    regimeType: "Liberal Democracy",
    incomeGroup: "High income",
  };

  assert.equal(
    tooltipValueForLayer("regime", country, values),
    "Liberal Democracy",
  );
  assert.equal(tooltipValueForLayer("income", country, values), "High income");
  assert.equal(
    fillForLayer("regime", country, values),
    legendFor("regime").at(-1)?.fill,
  );
  assert.equal(
    fillForLayer("income", country, values),
    legendFor("income").at(-1)?.fill,
  );

  const missing = { regimeType: null, incomeGroup: null };
  assert.equal(tooltipValueForLayer("regime", country, missing), NO_DATA_LABEL);
  assert.equal(fillForLayer("income", country, missing), NO_DATA_FILL);
});
