/**
 * Direct unit test for `mapVdemRowToOrdinal()` in
 * `src/lib/factbook/reconcile/cache.ts`.
 *
 * This is the pure function that maps a V-Dem "Regimes of the World"
 * (RoW) bucket label to the 1-4 ordinal written into
 * `jurisdictions.democracy_index` for legacy sortable-number callers.
 * It is the data-layer half of the "Liberal Democracy / Tier 4 of 4"
 * contract (the display half is locked by
 * `src/lib/peer-grouping/__tests__/vdem-row-tier.test.ts`).
 *
 * Until now the function was module-private and could only be tested
 * indirectly; it has been `export`ed (behaviour unchanged) so the exact
 * Closed=1 ... Liberal=4 mapping can be asserted directly.
 *
 * Pure: no DB, no network. The `db` client transitively imported by
 * `cache.ts` is a lazy Proxy (`src/lib/db/index.ts`) that only connects
 * on first query, so importing the module to call this pure helper does
 * not require `DATABASE_URL`. Runs under `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { mapVdemRowToOrdinal } from "../cache";

// The canonical RoW labels the function expects, exactly as stored in
// `country_facts` for fact-key `vdem_row` (Phase F vocabulary), paired
// with the ordinal the data layer must honour. Higher = more
// democratic. This is the same Closed->Liberal contract mirrored by
// `VDEM_ROW_META` in src/lib/peer-grouping/lens-metadata.ts.
const CANONICAL_ORDINALS: ReadonlyArray<readonly [string, number]> = [
  ["Closed Autocracy", 1],
  ["Electoral Autocracy", 2],
  ["Electoral Democracy", 3],
  ["Liberal Democracy", 4],
];

test("maps each canonical RoW label to its 1-4 ordinal (Closed=1 ... Liberal=4)", () => {
  for (const [label, ordinal] of CANONICAL_ORDINALS) {
    assert.equal(
      mapVdemRowToOrdinal(label),
      ordinal,
      `${label} should map to ordinal ${ordinal}`,
    );
  }
});

test("is case-insensitive (function lowercases before matching)", () => {
  // The production value is title-case, but the helper lowercases first,
  // so any casing of the same label resolves to the same ordinal.
  assert.equal(mapVdemRowToOrdinal("LIBERAL DEMOCRACY"), 4);
  assert.equal(mapVdemRowToOrdinal("liberal democracy"), 4);
  assert.equal(mapVdemRowToOrdinal("Closed autocracy"), 1);
});

test("matches when the label is a substring carrier (uses .includes)", () => {
  // The helper does substring matching, so a decorated label still
  // resolves to its tier rather than falling through to null.
  assert.equal(mapVdemRowToOrdinal("Liberal Democracy (V-Dem RoW)"), 4);
  assert.equal(mapVdemRowToOrdinal("Regime: Electoral Autocracy"), 2);
});

test("unknown / partial / numeric-looking labels -> null (never a raw number)", () => {
  // A numeric-looking string is NOT a valid RoW tier; it must resolve to
  // null rather than ever being rendered as e.g. "0.85 / 1.00".
  assert.equal(mapVdemRowToOrdinal("0.85"), null);
  assert.equal(mapVdemRowToOrdinal("garbage"), null);
  assert.equal(mapVdemRowToOrdinal(""), null);
  // Partial words don't satisfy the full-phrase check, so they're null —
  // this is what guards against a bare "Democracy"/"Autocracy" token
  // being misclassified.
  assert.equal(mapVdemRowToOrdinal("Democracy"), null);
  assert.equal(mapVdemRowToOrdinal("Autocracy"), null);
});

test("null / undefined input throws (helper expects a non-null string)", () => {
  // Documented contract: the parameter type is `string` and the body
  // calls `label.toLowerCase()` with no null guard. The sole production
  // caller (cache.ts) only invokes it inside
  // `if (vdemResult?.canonical?.factValue)`, so null never reaches it
  // there. These assertions lock that the guarding stays the caller's
  // job — if a future edit needs to accept null, it must do so
  // deliberately (and this test will flag the change).
  assert.throws(() => mapVdemRowToOrdinal(null as unknown as string), TypeError);
  assert.throws(
    () => mapVdemRowToOrdinal(undefined as unknown as string),
    TypeError,
  );
});
