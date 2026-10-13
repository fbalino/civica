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
const BODY = "src/components/constitution/ConstitutionReader.tsx";
const ISLAND = "src/components/constitution/ConstitutionHashFocus.tsx";

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
  // The text renders on the server with no in-column outline; the shared
  // FactbookSidebar owns nav. The interactive Explorer column is not used, so
  // the full text never crosses into a client component as a prop.
  assert.match(src, /constitution-reader-layout--no-outline/);
  assert.match(src, /<ConstitutionReaderBody sections=\{sections\} \/>/);
  assert.doesNotMatch(src, /ConstitutionReadingColumn/);
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

test("the Explorer reading column keeps its own outline", () => {
  const src = readFileSync(READER, "utf8");
  assert.match(src, /className="constitution-reader-nav"/);
  assert.match(src, /<ConstitutionReaderBody /);
});

test("the shared body is server-safe and its island takes no props", () => {
  const body = readFileSync(BODY, "utf8");
  assert.doesNotMatch(body, /^"use client"/);
  const island = readFileSync(ISLAND, "utf8");
  assert.match(island, /export function ConstitutionHashFocus\(\)/);
});
