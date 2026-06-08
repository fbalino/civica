/**
 * Regression tests for the citation formatters — `src/lib/cite/format.ts`.
 *
 * The fix under test: the PUBLICATION date (APA "(year)", Chicago
 * author-date year, BibTeX `year`) must come from `dataDate` — the data
 * vintage / last_sync_at — while the "Retrieved" / "Accessed" line and
 * the BibTeX `urldate` come from `accessedAt` (when the reader loaded the
 * page). When `dataDate` is absent the publication date is "n.d."
 * (APA/Chicago) or omitted entirely (BibTeX) — NEVER today's access date.
 *
 * Dates are built with the `new Date(y, monthIndex, d)` local-time
 * constructor (not ISO strings) so `toLocaleDateString` cannot shift a
 * day across the test machine's timezone. The long-form date string
 * ("June 7, 2026") assumes Node's default full-ICU en-US data, which
 * ships with Node >= 13 (this repo runs on Node 25).
 *
 * Pure: no DB, no network. Runs under `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatAPA, formatBibTeX, formatChicago, type CiteInput } from "../format";

// Data vintage is 2024; the reader accessed the page in 2026. The two
// years differ on purpose so "publication year = data vintage, NOT
// access year" is actually observable in every assertion below.
const WITH_DATE: CiteInput = {
  subject: "United States",
  pageTitle: "Structure",
  url: "https://civicaatlas.org/atlas/united-states/structure",
  accessedAt: new Date(2026, 5, 7), // June 7, 2026 (month index 5 = June)
  dataDate: new Date(2024, 2, 15), // March 15, 2024
  sourceNames: ["V-Dem", "World Bank WGI"],
};

const NO_DATE: CiteInput = {
  ...WITH_DATE,
  dataDate: null,
  sourceNames: undefined,
};

test("APA: (year) is the data vintage; Retrieved is the access date", () => {
  const out = formatAPA(WITH_DATE);
  assert.equal(
    out,
    "Civica. (2024). United States: Structure. Civica Atlas. Retrieved June 7, 2026, from https://civicaatlas.org/atlas/united-states/structure",
  );
  // Provenance: the parenthetical year is the 2024 data vintage, never
  // the 2026 access year.
  assert.ok(out.includes("(2024)"));
  assert.ok(!out.includes("(2026)"));
  assert.ok(out.includes("Retrieved June 7, 2026,"));
});

test("APA: no dataDate -> (n.d.), not today; access date still shown", () => {
  const out = formatAPA(NO_DATE);
  assert.equal(
    out,
    "Civica. (n.d.). United States: Structure. Civica Atlas. Retrieved June 7, 2026, from https://civicaatlas.org/atlas/united-states/structure",
  );
  assert.ok(out.includes("(n.d.)"));
  assert.ok(!out.includes("(2026)")); // access year is never used as the pub year
  assert.ok(out.includes("Retrieved June 7, 2026,")); // access line preserved
});

test("Chicago: author-date year is the data vintage", () => {
  const out = formatChicago(WITH_DATE);
  assert.equal(
    out,
    'Civica. 2024. "United States: Structure." Civica Atlas. Accessed June 7, 2026. https://civicaatlas.org/atlas/united-states/structure.',
  );
  assert.ok(out.includes("Civica. 2024."));
  assert.ok(!out.includes("Civica. 2026."));
  assert.ok(out.includes("Accessed June 7, 2026."));
});

test("Chicago: no dataDate -> n.d. (single terminal period)", () => {
  const out = formatChicago(NO_DATE);
  assert.equal(
    out,
    'Civica. n.d. "United States: Structure." Civica Atlas. Accessed June 7, 2026. https://civicaatlas.org/atlas/united-states/structure.',
  );
  assert.ok(out.includes("Civica. n.d. "));
  assert.ok(!out.includes("n.d..")); // n.d. already carries its own period
  assert.ok(out.includes("Accessed June 7, 2026."));
});

test("BibTeX: year = data vintage, urldate = access date, key carries vintage", () => {
  const out = formatBibTeX(WITH_DATE);
  assert.equal(
    out,
    [
      "@misc{civica-united-states-structure-2024,",
      "  title        = {United States: Structure},",
      "  author       = {{Civica}},",
      "  year         = {2024},",
      "  publisher    = {{Civica Atlas}},",
      "  url          = {https://civicaatlas.org/atlas/united-states/structure},",
      "  urldate      = {2026-06-07},",
      "  note         = {Data sources: V-Dem, World Bank WGI.},",
      "}",
    ].join("\n"),
  );
  // Whitespace-tolerant provenance checks (the load-bearing behaviour):
  assert.match(out, /year\s*=\s*\{2024\}/); // year is the data vintage
  assert.match(out, /urldate\s*=\s*\{2026-06-07\}/); // urldate is the access date
  assert.ok(!/year\s*=\s*\{2026\}/.test(out)); // never the access year
  assert.ok(out.includes("civica-united-states-structure-2024")); // key carries vintage
});

test("BibTeX: no dataDate -> year omitted entirely, key ends -nd", () => {
  const out = formatBibTeX(NO_DATE);
  assert.equal(
    out,
    [
      "@misc{civica-united-states-structure-nd,",
      "  title        = {United States: Structure},",
      "  author       = {{Civica}},",
      "  publisher    = {{Civica Atlas}},",
      "  url          = {https://civicaatlas.org/atlas/united-states/structure},",
      "  urldate      = {2026-06-07},",
      "}",
    ].join("\n"),
  );
  assert.ok(!/^\s*year\s*=/m.test(out)); // no fabricated year line at all
  assert.ok(out.includes("civica-united-states-structure-nd")); // key uses the nd token
  assert.match(out, /urldate\s*=\s*\{2026-06-07\}/); // access date still present
});
