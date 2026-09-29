/**
 * Render tests for Conditions attribution (CLM-020, publisher-attribution/v1):
 * a Civica 0 to 100 position always carries the "Civica calculation" marker
 * and its formula, the comparison view shows publisher components only, and
 * the explorer heads the position column as a Civica calculation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CompareConditions } from "@/components/compare/CompareConditions";
import {
  buildConditionsPublicRelease,
  type ConditionsPublicComponent,
  type ConditionsStoredCalculation,
} from "@/lib/conditions/public-release";

import { CivicaConditionsPanel } from "./CivicaConditionsPanel";
import { ConditionsReleaseExplorer } from "./ConditionsReleaseExplorer";

const RELEASE_ID = "conditions-fixture-v1";
const JAPAN = "japan-id";

function component(
  input: Partial<ConditionsPublicComponent> & Pick<ConditionsPublicComponent, "componentId">,
): ConditionsPublicComponent {
  return {
    nativeValue: null,
    nativeUnit: "percent",
    referenceYear: 2023,
    valueStatus: "observed",
    valueStatusReason: null,
    inclusionDecision: "included",
    sourceId: "world_bank",
    sourceName: "World Bank",
    indicatorId: "indicator",
    upstreamRelease: "fixture release",
    licenseUrl: "https://example.test/license",
    transformationId: "fixture-component/v1",
    ...input,
  };
}

function calculation(
  input: Partial<ConditionsStoredCalculation> &
    Pick<ConditionsStoredCalculation, "dimension" | "calculationKey" | "components">,
): ConditionsStoredCalculation {
  return {
    releaseId: RELEASE_ID,
    jurisdictionId: JAPAN,
    countryName: "Japan",
    countrySlug: "japan",
    countryIso3: "JPN",
    alignmentPolicy: "all-components-same-reference-year/v1",
    alignmentStatus: "aligned",
    referenceYear: 2023,
    normalizedScore: null,
    rawValue: null,
    scoreTransformationId: null,
    scoreSourceId: null,
    scoreSourceName: null,
    scoreIndicatorId: null,
    scoreUpstreamRelease: null,
    scoreLicenseUrl: null,
    ...input,
  };
}

const release = buildConditionsPublicRelease({
  release: {
    releaseId: RELEASE_ID,
    methodologyVersion: "conditions-components/v1",
    manifestSha256: "a".repeat(64),
    createdAt: "2026-07-29T17:05:02.240Z",
  },
  calculations: [
    calculation({
      dimension: "human_development",
      calculationKey: "conditions-calculation/v1/sha256:hdi",
      normalizedScore: 92,
      rawValue: 0.92,
      scoreTransformationId: "conditions-hdi-fixed-bound/v2",
      scoreSourceId: "undp_hdi",
      scoreSourceName: "UNDP",
      scoreIndicatorId: "hdi",
      components: [
        component({
          componentId: "hdi",
          nativeValue: 0.92,
          nativeUnit: "index_0_1",
          sourceId: "undp_hdi",
          sourceName: "UNDP",
          indicatorId: "hdi",
        }),
      ],
    }),
    calculation({
      dimension: "peace_security",
      calculationKey: "conditions-calculation/v1/sha256:gpi",
      normalizedScore: 91.6,
      rawValue: 1.336,
      scoreTransformationId: "conditions-gpi-fixed-bound/v2",
      scoreSourceId: "global_peace_index",
      scoreSourceName: "Institute for Economics & Peace",
      scoreIndicatorId: "GPI_SCORE",
      components: [
        component({
          componentId: "global_peace_index",
          nativeValue: 1.336,
          nativeUnit: "index_1_5_inverted",
          sourceId: "global_peace_index",
          sourceName: "Institute for Economics & Peace",
          indicatorId: "GPI_SCORE",
        }),
      ],
    }),
    calculation({
      dimension: "economic_stability",
      calculationKey: "conditions-calculation/v1/sha256:economic",
      components: [
        component({ componentId: "inflation", nativeValue: 3.3 }),
        component({ componentId: "unemployment", nativeValue: 2.6 }),
        component({ componentId: "gdp_growth", nativeValue: 1.9 }),
      ],
    }),
  ],
});

function unescape(markup: string): string {
  return markup.replaceAll("&#x27;", "'").replaceAll("&amp;", "&").replaceAll("&quot;", '"');
}

function renderPanel(showCivicaPosition?: boolean): string {
  return unescape(
    renderToStaticMarkup(
      createElement(CivicaConditionsPanel, {
        jurisdictionId: JAPAN,
        release,
        ...(showCivicaPosition === undefined ? {} : { showCivicaPosition }),
      }),
    ),
  );
}

test("country Conditions positions carry the Civica-calculation marker and formula", () => {
  const markup = renderPanel();
  assert.match(markup, /92 \/ 100/);
  assert.match(markup, /91\.6 \/ 100/);
  assert.equal(markup.match(/>Civica calculation</g)?.length, 2);
  assert.match(markup, /Civica multiplied UNDP's Human Development Index value \(0 to 1\) by 100\./);
  assert.match(markup, /\(5 − score\) ÷ 4 × 100/);
  assert.match(markup, /aria-label="How Civica calculated this number"/);
  assert.match(markup, /No composite published/);
  assert.match(markup, /0\.92 index_0_1/);
});

test("the comparison panel shows publisher components and no Civica position", () => {
  const markup = renderPanel(false);
  assert.equal(markup.includes("/ 100"), false);
  assert.equal(markup.includes("Civica calculation"), false);
  assert.match(markup, /0\.92 index_0_1/);
  assert.match(markup, /1\.34 index_1_5_inverted/);
  assert.match(markup, /No composite published/);
});

test("the compare view keeps its banner true: components only, never normalized", () => {
  const markup = unescape(
    renderToStaticMarkup(
      createElement(CompareConditions, {
        countries: [
          {
            jurisdiction: { id: JAPAN, slug: "japan", name: "Japan", iso2: "JP" },
            seriesColor: "var(--color-accent)",
          },
        ],
        release,
      }),
    ),
  );
  assert.match(markup, /Reference years can differ across countries or conditions; Civica does\s+not normalize, rank, or combine them here\./);
  assert.equal(markup.includes("/ 100"), false);
  assert.equal(markup.includes("Civica calculation"), false);
  assert.match(markup, /0\.92 index_0_1/);
});

test("the explorer heads the position column as a Civica calculation and lists the formulas", () => {
  const markup = unescape(
    renderToStaticMarkup(createElement(ConditionsReleaseExplorer, { release })),
  );
  assert.match(markup, /<th class="num">Civica calculation \/ year<\/th>/);
  assert.match(markup, /<th>Publisher input<\/th>/);
  assert.equal(markup.includes("Published position"), false);
  assert.equal(markup.includes("Score source"), false);
  assert.match(markup, /Civica calculates the 0 to 100 figures in the Civica calculation \/ year\s+column/);
  assert.match(markup, /<li>Civica multiplied UNDP's Human Development Index value/);
  assert.match(markup, /<li>Civica converted the Global Peace Index score/);
});
