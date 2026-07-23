import assert from "node:assert/strict";
import test from "node:test";

import FALLBACK_PALETTE from "./civica-map-fallback-palette.json";
import { fallbackCivicaMapPalette } from "./civica-map-style";

test("the map fallback palette remains a theme-specific data artifact", () => {
  assert.deepEqual(fallbackCivicaMapPalette(false), FALLBACK_PALETTE.light);
  assert.deepEqual(fallbackCivicaMapPalette(true), FALLBACK_PALETTE.dark);
});
