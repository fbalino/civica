/**
 * Regression tests for the V-Dem "Regimes of the World" (RoW)
 * tier -> ordinal + label mapping (the fix behind the
 * "Liberal Democracy / Tier 4 of 4" display, never "X / 1.00").
 *
 * Where the contract lives:
 *   - The exact 1-4 ordinal map `mapVdemRowToOrdinal()` is in
 *     `src/lib/factbook/reconcile/cache.ts`, but it is MODULE-PRIVATE
 *     (not exported), so it cannot be imported without modifying product
 *     code. (Closed Autocracy = 1 ... Liberal Democracy = 4.)
 *   - The "Tier N of 4" label helpers (`vdemRowTier`, `vdemRowLabel`,
 *     `VDEM_ROW_TIER_LABELS`) live route-locally in
 *     `src/app/(reader)/countries/[slug]/page.tsx` — a Next.js route
 *     module, not pure/importable.
 *
 * Both are reported in the handoff. This suite locks the EXPORTED, pure,
 * dependency-light source of truth for the same contract:
 * `VDEM_ROW_META` + `getPeerLensValueMeta` in
 * `src/lib/peer-grouping/lens-metadata.ts`. Its ascending `order`
 * (100/200/300/400) encodes the identical Closed->Liberal tier ordering,
 * its `label` is the canonical RoW label, and unknown values resolve to
 * `null` — the guarantee that the UI renders "Unclassified", never a raw
 * number against a fake "/ 1.00" maximum.
 *
 * Pure: no DB, no network. Runs under `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  VDEM_ROW_META,
  getPeerLensValueMeta,
  type VDemRowKey,
} from "../lens-metadata";

// The canonical RoW ordinal contract the data layer must honour. This
// mirrors `mapVdemRowToOrdinal()` in factbook/reconcile/cache.ts:
// Closed Autocracy = 1 ... Liberal Democracy = 4.
const CANON_ORDINAL: Record<VDemRowKey, number> = {
  "Closed Autocracy": 1,
  "Electoral Autocracy": 2,
  "Electoral Democracy": 3,
  "Liberal Democracy": 4,
};

test("VDEM_ROW_META has exactly the four RoW tiers, each self-labelled", () => {
  const keys = Object.keys(VDEM_ROW_META).sort();
  assert.deepEqual(keys, [
    "Closed Autocracy",
    "Electoral Autocracy",
    "Electoral Democracy",
    "Liberal Democracy",
  ]);
  for (const key of keys as VDemRowKey[]) {
    assert.equal(VDEM_ROW_META[key].label, key);
  }
});

test("ascending `order` yields ordinals Closed=1 ... Liberal=4", () => {
  // Rank the tiers by their `order` field; the 1-based rank position is
  // the RoW ordinal, which must match the canonical contract exactly.
  const ranked = (Object.keys(VDEM_ROW_META) as VDemRowKey[]).sort(
    (a, b) => VDEM_ROW_META[a].order - VDEM_ROW_META[b].order,
  );
  ranked.forEach((key, i) => {
    const ordinal = i + 1;
    assert.equal(
      ordinal,
      CANON_ORDINAL[key],
      `${key}: expected ordinal ${CANON_ORDINAL[key]}, got ${ordinal}`,
    );
  });
  // Liberal Democracy is the top tier ("Tier 4 of 4"); Closed Autocracy
  // the bottom ("Tier 1 of 4").
  assert.equal(ranked[0], "Closed Autocracy");
  assert.equal(ranked[ranked.length - 1], "Liberal Democracy");
  // Lock the actual order values currently in use so a silent reshuffle
  // is caught.
  assert.equal(VDEM_ROW_META["Closed Autocracy"].order, 100);
  assert.equal(VDEM_ROW_META["Electoral Autocracy"].order, 200);
  assert.equal(VDEM_ROW_META["Electoral Democracy"].order, 300);
  assert.equal(VDEM_ROW_META["Liberal Democracy"].order, 400);
});

test("getPeerLensValueMeta('vdem_row', label) resolves each tier's label", () => {
  for (const key of Object.keys(CANON_ORDINAL) as VDemRowKey[]) {
    const meta = getPeerLensValueMeta("vdem_row", key);
    assert.ok(meta !== null, `${key} should resolve to a meta record`);
    assert.equal(meta.label, key);
  }
});

test("unknown / numeric / null value -> null (UI shows Unclassified, never 'X / 1.00')", () => {
  // A numeric-looking string is NOT a valid RoW tier and must resolve to
  // null rather than ever being rendered as e.g. "0.85 / 1.00".
  assert.equal(getPeerLensValueMeta("vdem_row", "0.85"), null);
  assert.equal(getPeerLensValueMeta("vdem_row", "garbage"), null);
  assert.equal(getPeerLensValueMeta("vdem_row", ""), null);
  assert.equal(getPeerLensValueMeta("vdem_row", null), null);
  assert.equal(getPeerLensValueMeta("vdem_row", undefined), null);
});
