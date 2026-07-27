/**
 * EXP-032 — the country Constitution tab shares the canonical three-tab shell
 * (country search + sidebar + body geometry) with the Factbook and Civica Data
 * tabs, and does not duplicate the country name in a heading. The standalone
 * Constitution Explorer keeps its own in-column outline.
 *
 * Source-based guard (no DB): locks the composition so the tab can't silently
 * drift back to its own bespoke `editorial-page--full` shell.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const TAB = "src/app/(reader)/country/[slug]/constitution/page.tsx";
const READER = "src/components/constitution/ConstitutionReadingColumn.tsx";

test("the constitution tab composes the shared country-tab shell", () => {
  const src = readFileSync(TAB, "utf8");
  // Same wrapper, grid, left rail, search and sidebar as the other two tabs.
  for (const token of [
    "factbook-tab",
    "civica-data-body",
    "factbook-left-rail",
    "CountryJumpSearch",
    "FactbookSidebar",
  ]) {
    assert.match(src, new RegExp(token), `constitution tab missing ${token}`);
  }
});

test("the tab renders the reading body with the outline in the shared sidebar", () => {
  const src = readFileSync(TAB, "utf8");
  // The in-column outline is suppressed; the shared FactbookSidebar owns nav.
  assert.match(src, /showOutline=\{false\}/);
});

test("the tab does not reintroduce the bespoke constitution shell", () => {
  const src = readFileSync(TAB, "utf8");
  assert.doesNotMatch(src, /editorial-page--full/);
  assert.doesNotMatch(src, /country-constitution-body/);
});

test("no heading duplicates the country name", () => {
  const src = readFileSync(TAB, "utf8");
  // The masthead <h1> already carries the country name; the tab's <h2> must
  // not repeat it (the old "Constitution of {name}" / "...for {name} yet").
  assert.doesNotMatch(src, /Constitution of \{jurisdiction\.name\}/);
  assert.doesNotMatch(src, /available for \{jurisdiction\.name\}/);
});

test("the reading column defaults showOutline to true (standalone Explorer safe)", () => {
  const src = readFileSync(READER, "utf8");
  assert.match(src, /showOutline = true/);
  // The no-outline layout variant exists for the country tab.
  assert.match(src, /constitution-reader-layout--no-outline/);
});
