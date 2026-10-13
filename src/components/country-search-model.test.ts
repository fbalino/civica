import assert from "node:assert/strict";
import test from "node:test";

import directory from "../lib/jurisdictions/directory.generated.json";
import type { JurisdictionDirectoryArtifact } from "../lib/jurisdictions/directory";
import { buildJurisdictionDirectoryAsset } from "../lib/jurisdictions/directory-asset";
import {
  filterCountryOptions,
  nextSelectedIndex,
} from "./country-search-model";

const assetRows = buildJurisdictionDirectoryAsset(
  directory as JurisdictionDirectoryArtifact,
).rows;

test("the shared directory matches ISO-3 codes (URY, GBR, JPN)", () => {
  for (const [code, slug] of [
    ["URY", "uruguay"],
    ["GBR", "united-kingdom"],
    ["JPN", "japan"],
  ] as const) {
    const hits = filterCountryOptions(assetRows, code).map((row) => row.slug);
    assert.ok(hits.includes(slug), `${code} should find ${slug}; got ${hits}`);
  }
});

test("arrow keys on an empty (still loading) list keep a valid index", () => {
  assert.equal(nextSelectedIndex(0, 1, 0), 0);
  assert.equal(nextSelectedIndex(0, -1, 0), 0);
});

test("arrow keys clamp within the result list", () => {
  assert.equal(nextSelectedIndex(0, 1, 3), 1);
  assert.equal(nextSelectedIndex(2, 1, 3), 2);
  assert.equal(nextSelectedIndex(0, -1, 3), 0);
  // A stale index from before the list shrank is pulled back in range.
  assert.equal(nextSelectedIndex(7, 1, 3), 2);
  assert.equal(nextSelectedIndex(-1, 1, 3), 0);
});
