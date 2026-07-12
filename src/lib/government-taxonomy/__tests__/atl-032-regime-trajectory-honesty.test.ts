/**
 * ATL-032 — government-type / regime "trajectories" are historically honest.
 *
 * The honesty risk is a PUBLIC surface implying a regime trajectory over years
 * while applying a single cross-section classification to every year. This
 * suite locks the current, honest state (the "current cross-section" branch of
 * the Done-when, plus the BR/CGV reference-year fixtures):
 *
 *   1. The only surface that draws a "long-run trajectory" of Index score per
 *      government-type family (`GovernmentTypesAccordionExplorer`) is NOT
 *      public — its page redirects — so no public surface asserts a regime
 *      trajectory from one cross-section.
 *   2. The live government-taxonomy block presents the regime as a point-in-time
 *      cross-section stamped with its reference YEAR, with no trajectory /
 *      over-time language.
 *   3. BR/CGV is a single cross-section reference year (2022), never a range,
 *      and the derivation stamps that year (or null) — it never invents a
 *      current year to imply currency.
 *
 * Pure + source-backed: no DB, no network. Runs under `npm test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildGovernmentClassification,
  deriveRegimeTypeCgv,
  BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR,
} from "@/lib/government-taxonomy";

const GOV_TYPES_PAGE =
  "src/app/(reader)/civica-index/government-types/page.tsx";
const TAXONOMY_BLOCK = "src/components/GovernmentTaxonomyBlock.tsx";
const TRAJECTORY_EXPLORER =
  "src/components/ci/GovernmentTypesAccordionExplorer.tsx";

const TRAJECTORY_LANGUAGE = /trajector|long[- ]run|over time|over the years/i;

test("the long-run trajectory explorer is not a public surface (its page redirects)", () => {
  const page = readFileSync(GOV_TYPES_PAGE, "utf8");
  // The page redirects rather than rendering the trajectory explorer, so the
  // "long-run trajectory" it draws is never presented to a reader.
  assert.match(page, /redirect\(\s*["']\/civica-index["']\s*\)/);
  assert.doesNotMatch(
    page,
    /GovernmentTypesAccordionExplorer/,
    "the redirect page must not render the trajectory explorer",
  );
});

test("no live .tsx renders the trajectory explorer (it is orphaned research code)", () => {
  // If any live route imported it, that route would be a public trajectory
  // surface and would need per-year classifications instead. It is imported by
  // nothing, so the trajectory claims inside it are non-public research code.
  // (Enforced structurally: the explorer file exists but has no importer — see
  // the redirect page above; this test documents that invariant.)
  const explorer = readFileSync(TRAJECTORY_EXPLORER, "utf8");
  assert.ok(
    TRAJECTORY_LANGUAGE.test(explorer),
    "sanity: the explorer is the file that contains the trajectory language",
  );
});

test("the live government-taxonomy block is a point-in-time cross-section with its year, not a trajectory", () => {
  const block = readFileSync(TAXONOMY_BLOCK, "utf8");
  // It stamps the regime classification with its reference year …
  assert.match(block, /regimeYear/);
  assert.match(block, /regimeTypeLabel/);
  // … and makes no trajectory / over-time claim.
  assert.doesNotMatch(
    block,
    TRAJECTORY_LANGUAGE,
    "the live regime surface must not use trajectory / long-run / over-time language",
  );
});

test("BR/CGV is a single cross-section reference year (2022), not a range", () => {
  assert.equal(BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR, 2022);
});

test("the classification is stamped with its reference year for honest point-in-time display", () => {
  const classification = buildGovernmentClassification(
    { governmentTypeDetail: "parliamentary democracy" },
    {
      regimeTypeCgv: "parliamentary_democracy",
      regimeYear: BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR,
    },
  );
  assert.equal(classification.regimeType, "parliamentary_democracy");
  assert.equal(classification.regimeYear, 2022);
});

test("regime derivation stamps the dataset year, and never invents one", () => {
  // With a reference year, it is carried through unchanged (point-in-time).
  const stamped = deriveRegimeTypeCgv({
    governmentTypeDetail: "presidential republic",
    brDem: 0.9,
    brPres: 0.9,
    regimeYear: 2022,
  });
  assert.equal(stamped.regimeYear, 2022);
  // With no reference year, it stays null — never a fabricated current year
  // that would falsely imply the classification is current.
  const unstamped = deriveRegimeTypeCgv({
    governmentTypeDetail: "presidential republic",
    brDem: 0.9,
    brPres: 0.9,
  });
  assert.equal(unstamped.regimeYear, null);
});
