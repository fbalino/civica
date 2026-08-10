import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildBundledMapPaths,
  buildFallbackMapPaths,
} from "./useMapPaths";
import type { Country } from "./data";

const source = readFileSync(
  new URL("./useMapPaths.ts", import.meta.url),
  "utf8",
);

test("Atlas map conversion stays inside the application bundle", () => {
  assert.match(source, /import \{ feature \} from "topojson-client";/);
  assert.match(source, /import worldAtlas from "world-atlas\/countries-110m\.json";/);
  assert.doesNotMatch(source, /document\.createElement\(["']script["']\)/);
  assert.doesNotMatch(source, /https:\/\/unpkg\.com\/topojson-client/);
});

test("Atlas retains the curated map fallback", () => {
  assert.match(source, /Object\.entries\(WORLD_PATHS\)/);
  assert.match(source, /setMapLoaded\(true\)/);
});

const unitedStates: Country = {
  id: "usa",
  name: "United States",
  leader: "",
  gov: "",
  region: "Americas",
  pop: "",
  gdp: "",
  capital: "Washington, D.C.",
};

test("bundled topology still produces linked country paths", () => {
  const paths = buildBundledMapPaths([unitedStates], { "840": "usa" });
  const unitedStatesPath = paths.find((path) => path.neId === "840");

  assert.ok(paths.length > 170);
  assert.equal(unitedStatesPath?.id, "usa");
  assert.equal(unitedStatesPath?.country, unitedStates);
  assert.match(unitedStatesPath?.d ?? "", /^M/);
});

test("fallback paths still link curated geometry to countries", () => {
  const paths = buildFallbackMapPaths([unitedStates]);
  const unitedStatesPath = paths.find((path) => path.id === "usa");

  assert.equal(unitedStatesPath?.country, unitedStates);
  assert.equal(unitedStatesPath?.area, 1000);
  assert.match(unitedStatesPath?.d ?? "", /^M/);
});
