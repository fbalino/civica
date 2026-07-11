import test from "node:test";
import assert from "node:assert/strict";
import { K1_SOURCE_ECOSYSTEM_MAP } from "./source-ecosystem-dependence";

test("every K1 input is third-party and overlaps are explicit", () => {
  assert.equal(K1_SOURCE_ECOSYSTEM_MAP.units.length, 4);
  assert.ok(K1_SOURCE_ECOSYSTEM_MAP.units.every((unit) => !unit.civicaObservation));
  assert.ok(K1_SOURCE_ECOSYSTEM_MAP.documentedEdges.some((edge) => edge.from === "vdem" && edge.to === "worldbank_wgi"));
  assert.ok(K1_SOURCE_ECOSYSTEM_MAP.documentedEdges.some((edge) => edge.from === "freedom_house" && edge.to === "worldbank_wgi"));
  assert.match(K1_SOURCE_ECOSYSTEM_MAP.deletionLimit, /not identifiable/);
});
