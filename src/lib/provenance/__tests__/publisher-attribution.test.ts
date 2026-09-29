/**
 * publisher-attribution/v1 (CLM-020): value checks, reader explanations, API
 * examples, and the static scan with its seeded mutations. DB-free.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { EXAMPLES } from "@/lib/api/contract/examples";
import { EXPECTED_PARAMETER_CONTRACT } from "@/lib/conditions/release-live-validation";

import {
  CIVICA_CALCULATION_DISCLOSURES,
  civicaCalculationDisclosure,
  describeDisplayedValueOrigin,
  fixedBoundPosition,
} from "../publisher-attribution";
import {
  numericTokens,
  publisherAttributionErrors,
  scaleEndClusterSignature,
} from "../publisher-attribution-check";
import { baselineFromRegistry } from "../publisher-attribution-registry";
import { scanPublisherAttribution } from "../publisher-attribution-scan";
import {
  PUBLISHER_ATTRIBUTION_SEEDED_MUTATIONS,
  formatPublisherAttributionIssue,
  proveScan,
  proveValueCheck,
  readPublisherAttributionScanInput,
} from "../publisher-attribution-selfproof";

test("numericTokens reads printed numbers, signs, separators, and ranges", () => {
  const values = (text: string) => numericTokens(text).map((token) => token.value);
  assert.deepEqual(values("73 / 100"), [73, 100]);
  assert.deepEqual(values("−0.04"), [-0.04]);
  assert.deepEqual(values("-3 seats"), [-3]);
  assert.deepEqual(values("1,234.5 people"), [1234.5]);
  assert.deepEqual(values("1–5"), [1, 5]);
  assert.deepEqual(values("2023-2024"), [2023, 2024]);
  assert.deepEqual(values("Free · Freedom in the World"), []);
  assert.deepEqual(numericTokens("0.769").map((token) => token.decimals), [3]);
});

test("publisher figures pass at their printed precision and nothing else passes", () => {
  const base = { surfaceId: "fixture", markerRendered: false };
  const origin = { kind: "publisher_published" as const };
  assert.deepEqual(
    publisherAttributionErrors({ ...base, valueText: "73 / 100", origin, publisherFigures: [73, 100] }),
    [],
  );
  assert.deepEqual(
    publisherAttributionErrors({ ...base, valueText: "0.77", origin, publisherFigures: [0.769] }),
    [],
  );
  assert.match(
    publisherAttributionErrors({ ...base, valueText: "0.78", origin, publisherFigures: [0.769] }).join(),
    /shows 0\.78, which is not the publisher's own figure/,
  );
  assert.match(
    publisherAttributionErrors({ ...base, valueText: "0.769", origin: null, publisherFigures: [0.769] }).join(),
    /has no declared origin/,
  );
  assert.match(
    publisherAttributionErrors({
      ...base,
      valueText: "Free (100/100)",
      origin: { kind: "publisher_rule_applied", ruleId: "rule", note: "note" },
      publisherFigures: [2],
    }).join(),
    /must not print a number/,
  );
});

test("a Civica calculation needs its marker, a registered explanation, and the right position", () => {
  const origin = { kind: "civica_calculation" as const, transformationId: "conditions-hdi-fixed-bound/v2" };
  const display = { surfaceId: "fixture", valueText: "92 / 100", publisherFigures: [], calculationInput: 0.92 };
  assert.deepEqual(publisherAttributionErrors({ ...display, origin, markerRendered: true }), []);
  assert.match(
    publisherAttributionErrors({ ...display, origin, markerRendered: false }).join(),
    /without its visible marker/,
  );
  assert.match(
    publisherAttributionErrors({ ...display, valueText: "91 / 100", origin, markerRendered: true }).join(),
    /maps 0\.92 to 92/,
  );
  assert.deepEqual(
    publisherAttributionErrors({
      ...display,
      valueText: "100 / 100",
      calculationInput: 1,
      origin,
      markerRendered: true,
    }),
    [],
  );
  assert.match(
    publisherAttributionErrors({
      ...display,
      origin: { kind: "civica_calculation", transformationId: "unregistered/v1" },
      markerRendered: true,
    }).join(),
    /has no registered reader explanation/,
  );
  const gpi = { kind: "civica_calculation" as const, transformationId: "conditions-gpi-fixed-bound/v2" };
  assert.deepEqual(
    publisherAttributionErrors({ ...display, valueText: "64 / 100", calculationInput: 2.44, origin: gpi, markerRendered: true }),
    [],
  );
});

test("the scale-end signature describes clustering, and native V-Dem values do not cluster", () => {
  const saturated = [...Array(22).fill(100), ...Array.from({ length: 78 }, (_, index) => index)];
  assert.equal(scaleEndClusterSignature(saturated, { min: 0, max: 100 }).flagged, true);
  const native = Array.from({ length: 170 }, (_, index) => 0.009 + (index / 169) * 0.874);
  const signature = scaleEndClusterSignature(native, { min: 0, max: 1 });
  assert.equal(signature.flagged, false);
  assert.equal(signature.shareAtMax, 0);
});

test("every reader explanation matches the frozen Conditions parameter contract", () => {
  const ranked = Object.entries(EXPECTED_PARAMETER_CONTRACT).filter(
    ([, entry]) => entry.direction !== "not_ranked",
  );
  assert.equal(ranked.length, Object.keys(CIVICA_CALCULATION_DISCLOSURES).length);
  for (const [componentId, entry] of ranked) {
    const disclosure = civicaCalculationDisclosure(entry.transformationId);
    assert.ok(disclosure, entry.transformationId);
    assert.equal(disclosure.componentId, componentId);
    assert.equal(disclosure.direction, entry.direction);
    assert.equal(disclosure.lowerBound, entry.lowerBound);
    assert.equal(disclosure.upperBound, entry.upperBound);
    assert.ok(disclosure.summary.includes(String(disclosure.lowerBound)));
    assert.ok(disclosure.summary.includes(String(disclosure.upperBound)));
  }
  assert.deepEqual(
    describeDisplayedValueOrigin({ kind: "civica_calculation", transformationId: "conditions-hdi-fixed-bound/v2" }),
    {
      visibleLabel: "Civica calculation",
      buttonLabel: "How Civica calculated this number",
      explanation: CIVICA_CALCULATION_DISCLOSURES["conditions-hdi-fixed-bound/v2"].summary,
    },
  );
  assert.equal(describeDisplayedValueOrigin({ kind: "publisher_published" }), null);
});

test("the Conditions API example is internally consistent and marks every position", () => {
  const calculations = EXAMPLES.conditions.data.calculations;
  let scored = 0;
  for (const calculation of calculations) {
    if (calculation.normalizedScore === null) {
      assert.equal(calculation.scoreOrigin, null, calculation.dimension);
      continue;
    }
    scored += 1;
    assert.ok(calculation.scoreOrigin, calculation.dimension);
    const disclosure = civicaCalculationDisclosure(calculation.scoreOrigin.transformationId);
    assert.ok(disclosure, calculation.scoreOrigin.transformationId);
    assert.equal(calculation.components.length, 1);
    assert.equal(calculation.rawValue, calculation.components[0].nativeValue);
    assert.ok(
      Math.abs(calculation.normalizedScore - fixedBoundPosition(disclosure, calculation.rawValue!)) < 1e-9,
      `${calculation.dimension} position does not replay`,
    );
  }
  assert.equal(scored, 2);
});

test("the static scan passes the repository and each seeded mutation fails with its rule", () => {
  const input = readPublisherAttributionScanInput(process.cwd());
  assert.deepEqual(scanPublisherAttribution(input).map(formatPublisherAttributionIssue), []);
  assert.deepEqual(input.baseline, baselineFromRegistry());
  assert.deepEqual(proveValueCheck(), []);
  assert.deepEqual(proveScan(input), []);
  assert.ok(PUBLISHER_ATTRIBUTION_SEEDED_MUTATIONS.length >= 10);
});

test("the scan fails on the former Freedom House formatter and ignores comments", () => {
  const input = readPublisherAttributionScanInput(process.cwd());
  const sources = new Map(input.sources);
  sources.set(
    "src/lib/db/queries-scores.ts",
    `${sources.get("src/lib/db/queries-scores.ts")}\n// Math.round(latest.normalizedScore) in a comment is not code.\n`,
  );
  assert.deepEqual(scanPublisherAttribution({ ...input, sources }), []);
  sources.set(
    "src/lib/db/queries-scores.ts",
    `${sources.get("src/lib/db/queries-scores.ts")}\nexport const formerRow = (latest: { normalizedScore: number }) => \`Free (\${Math.round(latest.normalizedScore)}/100)\`;\n`,
  );
  const rules = scanPublisherAttribution({ ...input, sources }).map((issue) => issue.rule);
  assert.deepEqual(rules, ["derived-field-not-allowed"]);
});
