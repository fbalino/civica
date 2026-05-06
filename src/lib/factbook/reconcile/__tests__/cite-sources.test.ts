/**
 * Tests for the cite-accordion source-list helper.
 *
 * Run via:
 *   npx tsx src/lib/factbook/reconcile/__tests__/cite-sources.test.ts
 *
 * Targets `labelAndSortSourceIds` — the pure inner helper. The outer
 * `getDistinctActiveSourcesForJurisdiction` is just a thin DB wrapper
 * around this same shape, verified by Phase 1's live probe (USA = 14
 * sources, Argentina = 13, Marshall Islands = 10).
 *
 * Methodology: ~/civica/plan/cite-accordion-rollout-v1.md §4.
 */

import assert from "node:assert/strict";
import { labelAndSortSourceIds } from "@/lib/factbook/reconcile/api";

let pass = 0;
let fail = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  pass  ${name}`);
    pass++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log("    ", (err as Error).message);
    fail++;
  }
}

console.log("cite-sources.test.ts");

test("empty input returns empty array", () => {
  const out = labelAndSortSourceIds([]);
  assert.deepEqual(out, []);
});

test("maps source IDs to human-readable labels via SOURCE_LABELS", () => {
  const out = labelAndSortSourceIds(["world_bank"]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "world_bank");
  assert.equal(out[0].name, "World Bank");
});

test("falls back to source ID when label is unknown", () => {
  const out = labelAndSortSourceIds(["totally_made_up_source_id"]);
  assert.equal(out[0].name, "totally_made_up_source_id");
});

test("sorts alphabetically by display name", () => {
  const out = labelAndSortSourceIds([
    "world_bank",
    "fao_faostat",
    "imf_weo",
  ]);
  assert.deepEqual(
    out.map((r) => r.name),
    ["FAO FAOSTAT", "IMF (WEO)", "World Bank"]
  );
});

test("pins cia_factbook and wikidata to the end of the list", () => {
  const out = labelAndSortSourceIds([
    "cia_factbook",
    "world_bank",
    "wikidata",
    "imf_weo",
    "vdem",
  ]);
  // Non-pinned sources first (alphabetical by display name), then pinned.
  assert.deepEqual(
    out.map((r) => r.id),
    ["imf_weo", "vdem", "world_bank", "cia_factbook", "wikidata"]
  );
});

test("orders pinned sources alphabetically among themselves", () => {
  const out = labelAndSortSourceIds(["wikidata", "cia_factbook"]);
  // CIA World Factbook < Wikidata alphabetically.
  assert.deepEqual(
    out.map((r) => r.id),
    ["cia_factbook", "wikidata"]
  );
});

test("Marshall Islands shape — 10 sources, no NSO/V-Dem/ILO/OECD", () => {
  // From Phase 1 live probe (2026-05-05).
  const sourceIds = [
    "cia_factbook",
    "fao_faostat",
    "imf_weo",
    "un_data",
    "undp_hdi",
    "unesco_uis",
    "who_gho",
    "wikidata",
    "world_bank",
    "wto_stats",
  ];
  const out = labelAndSortSourceIds(sourceIds);
  assert.equal(out.length, 10);
  // Last two slots reserved for cia_factbook + wikidata in alpha order.
  assert.equal(out[out.length - 2].id, "cia_factbook");
  assert.equal(out[out.length - 1].id, "wikidata");
  // First slot: FAO FAOSTAT (alphabetical winner among non-pinned).
  assert.equal(out[0].name, "FAO FAOSTAT");
});

console.log(`\n  ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
}
