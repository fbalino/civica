import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConditionsPublicRelease,
  conditionsPublicReleaseErrors,
  selectConditionsPublicRelease,
  type ConditionsPublicCalculation,
  type ConditionsPublicReleaseHeader,
} from "../public-release";

const releases: ConditionsPublicReleaseHeader[] = [
  {
    releaseId: "conditions-fixture-v1",
    methodologyVersion: "conditions-components/v1",
    manifestSha256: "a".repeat(64),
    createdAt: "2026-07-10T00:00:00.000Z",
  },
  {
    releaseId: "conditions-fixture-v2",
    methodologyVersion: "conditions-components/v1",
    manifestSha256: "b".repeat(64),
    createdAt: "2026-07-11T00:00:00.000Z",
  },
];

function calculation(input: Partial<ConditionsPublicCalculation> = {}): ConditionsPublicCalculation {
  return {
    releaseId: "conditions-fixture-v2",
    jurisdictionId: "uruguay-id",
    countryName: "Uruguay",
    countrySlug: "uruguay",
    countryIso3: "URY",
    dimension: "human_development",
    calculationKey: "conditions-calculation/v1/sha256:fixture",
    alignmentPolicy: "all-components-same-reference-year/v1",
    alignmentStatus: "aligned",
    referenceYear: 2024,
    normalizedScore: 83.4,
    rawValue: 0.83,
    scoreSourceId: "undp_hdi",
    scoreSourceName: "UNDP",
    scoreIndicatorId: "hdi",
    scoreUpstreamRelease: "HDR 2025",
    scoreLicenseUrl: "https://example.test/undp",
    components: [{
      componentId: "hdi",
      nativeValue: 0.83,
      nativeUnit: "index_0_1",
      referenceYear: 2024,
      valueStatus: "observed",
      valueStatusReason: null,
      inclusionDecision: "included",
      sourceId: "undp_hdi",
      sourceName: "UNDP",
      indicatorId: "hdi",
      upstreamRelease: "HDR 2025",
      licenseUrl: "https://example.test/undp",
      transformationId: "conditions-hdi-component/v2",
    }],
    ...input,
  };
}

test("Conditions public release selects one immutable release deterministically", () => {
  assert.equal(selectConditionsPublicRelease(releases)?.releaseId, "conditions-fixture-v2");
  assert.equal(selectConditionsPublicRelease(releases, "conditions-fixture-v1")?.manifestSha256, "a".repeat(64));
  assert.equal(selectConditionsPublicRelease(releases, "conditions-missing-v1"), null);
});

test("Conditions public coverage derives from calculations and keeps refused inputs visible", () => {
  const release = selectConditionsPublicRelease(releases)!;
  const model = buildConditionsPublicRelease({
    release,
    calculations: [
      calculation(),
      calculation({
        jurisdictionId: "chile-id",
        countryName: "Chile",
        countrySlug: "chile",
        dimension: "economic_stability",
        calculationKey: "conditions-calculation/v1/sha256:economic",
        alignmentStatus: "mixed_year_refused",
        referenceYear: null,
        normalizedScore: null,
        rawValue: null,
        scoreSourceId: null,
        scoreSourceName: null,
        scoreIndicatorId: null,
        scoreUpstreamRelease: null,
        scoreLicenseUrl: null,
        components: [
          {
            componentId: "inflation",
            nativeValue: 4.2,
            nativeUnit: "percent",
            referenceYear: 2024,
            valueStatus: "observed",
            valueStatusReason: null,
            inclusionDecision: "refused_mixed_year",
            sourceId: "worldbank",
            sourceName: "World Bank",
            indicatorId: "FP.CPI.TOTL.ZG",
            upstreamRelease: "WDI 2025",
            licenseUrl: "https://example.test/worldbank",
            transformationId: "conditions-economic-component/v1",
          },
          {
            componentId: "gdp_growth",
            nativeValue: null,
            nativeUnit: "percent",
            referenceYear: null,
            valueStatus: "missing",
            valueStatusReason: "not published",
            inclusionDecision: "refused_mixed_year",
            sourceId: "worldbank",
            sourceName: "World Bank",
            indicatorId: "NY.GDP.MKTP.KD.ZG",
            upstreamRelease: "WDI 2025",
            licenseUrl: "https://example.test/worldbank",
            transformationId: "conditions-economic-component/v1",
          },
        ],
      }),
    ],
  });

  assert.equal(model.calculations[0].countryName, "Chile");
  assert.deepEqual(model.coverage, [
    {
      dimension: "human_development",
      calculations: 1,
      aligned: 1,
      scored: 1,
      mixedYearRefused: 0,
      missingComponent: 0,
      components: 1,
      observedComponents: 1,
      unavailableComponents: 0,
    },
    {
      dimension: "peace_security",
      calculations: 0,
      aligned: 0,
      scored: 0,
      mixedYearRefused: 0,
      missingComponent: 0,
      components: 0,
      observedComponents: 0,
      unavailableComponents: 0,
    },
    {
      dimension: "economic_stability",
      calculations: 1,
      aligned: 0,
      scored: 0,
      mixedYearRefused: 1,
      missingComponent: 0,
      components: 2,
      observedComponents: 1,
      unavailableComponents: 1,
    },
  ]);
});

test("Conditions public release refuses a mismatched or scored unaligned calculation", () => {
  const errors = conditionsPublicReleaseErrors({
    release: releases[1],
    calculations: [calculation({ releaseId: "conditions-fixture-v1", normalizedScore: 20 })],
  });
  assert.match(errors.join(" "), /belongs to another release/);
});

test("Conditions public release never exposes an economic-stability composite", () => {
  const errors = conditionsPublicReleaseErrors({
    release: releases[1],
    calculations: [
      calculation({
        dimension: "economic_stability",
        normalizedScore: 72.4,
        rawValue: 0.724,
      }),
    ],
  });
  assert.match(errors.join(" "), /economic stability must not publish a composite score/);
});
