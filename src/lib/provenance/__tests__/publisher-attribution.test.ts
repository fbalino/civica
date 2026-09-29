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
import { baselineFromRegistry, type ScaleSuffixAllowance } from "../publisher-attribution-registry";
import {
  SCALE_SUFFIX_PATTERN,
  checkedPublisherAttributionRegistry,
  scaleSuffixFragments,
  scanPublisherAttribution,
} from "../publisher-attribution-scan";
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
  assert.ok(PUBLISHER_ATTRIBUTION_SEEDED_MUTATIONS.length >= 16);
  const seededRules = new Set(PUBLISHER_ATTRIBUTION_SEEDED_MUTATIONS.map((mutation) => mutation.rule));
  for (const rule of ["scale-suffix-unregistered", "scale-suffix-allowance-stale"] as const) {
    assert.ok(seededRules.has(rule), `no seeded mutation proves ${rule}`);
  }
});

test("the scan fails on the former Freedom House formatter and ignores comments", () => {
  const input = readPublisherAttributionScanInput(process.cwd());
  const sources = new Map(input.sources);
  sources.set(
    "src/lib/db/queries-scores.ts",
    `${sources.get("src/lib/db/queries-scores.ts")}\n// Math.round(latest.normalizedScore) printed as "Free (100/100)" in a comment is not code.\n`,
  );
  assert.deepEqual(scanPublisherAttribution({ ...input, sources }), []);
  sources.set(
    "src/lib/db/queries-scores.ts",
    `${sources.get("src/lib/db/queries-scores.ts")}\nexport const formerRow = (latest: { normalizedScore: number }) => \`Free (\${Math.round(latest.normalizedScore)}/100)\`;\n`,
  );
  const rules = scanPublisherAttribution({ ...input, sources }).map((issue) => issue.rule);
  assert.deepEqual(rules, ["derived-field-not-allowed", "scale-suffix-unregistered"]);
});

test("the scan fails on the review's scale-suffix regression in a file it could not see before", () => {
  // The review of 2026-09-29: a new file with no SourceDot and no registered
  // field printed the former row's form. It passed every gate until the
  // scale-suffix rule.
  const input = readPublisherAttributionScanInput(process.cwd());
  const sources = new Map(input.sources);
  sources.set(
    "src/components/zz/FhBadge.tsx",
    "export function FhBadge({ rawValue }: { rawValue: number }) {\n  const position = Math.round(((14 - rawValue) / 12) * 100);\n  return <p>Freedom House: Free ({position}/100)</p>;\n}\n",
  );
  assert.deepEqual(scanPublisherAttribution({ ...input, sources }).map(formatPublisherAttributionIssue), [
    '[scale-suffix-unregistered] src/components/zz/FhBadge.tsx: prints a 0-to-100 scale suffix ("/100)") but is not in SCALE_SUFFIX_ALLOWANCES. Show the publisher\'s own figure on the publisher\'s scale, or mark the Civica position with ValueOriginNote on a registered Civica-calculation surface and list the file',
  ]);
});

test("scale suffixes are read from printed text, not arithmetic, patterns, or comments", () => {
  const fragments = (source: string, path = "src/components/example/Fixture.tsx") =>
    scaleSuffixFragments(path, source);
  assert.deepEqual(
    fragments("export const A = ({ p }: { p: number }) => <p>Free ({p}/100)</p>;"),
    ["/100)"],
  );
  assert.deepEqual(fragments("export const B = ({ p }: { p: number }) => <p>{p} / 100</p>;"), [
    "/ 100",
  ]);
  assert.deepEqual(fragments("export const C = (p: number) => `${p} / 100`;", "src/lib/c.ts"), [
    "/ 100",
  ]);
  assert.deepEqual(fragments('export const D = "Free (100/100)";', "src/lib/d.ts"), [
    "Free (100/100)",
  ]);
  assert.deepEqual(fragments('export const E = <Score label="/ 100" />;'), ["/ 100"]);
  assert.deepEqual(fragments("export const F = 'scored 83 out of 100.';", "src/lib/f.ts"), [
    "scored 83 out of 100.",
  ]);
  assert.deepEqual(fragments("export const G = `${1} / 100.`;", "src/lib/g.ts"), ["/ 100."]);
  for (const silent of [
    "export const H = (x: number) => x / 100;",
    "export const I = Math.round(3.14159 * 100) / 100;",
    "export const J = /100%\\s*uptime/i;",
    "// Free (100/100) in a comment\nexport const K = 1;",
    'export const L = "1/1000";',
    'export const M = "1/100.5";',
    'export const N = "per 1/100,000 people";',
  ]) {
    assert.deepEqual(fragments(silent, "src/lib/silent.ts"), [], silent);
  }
  assert.equal(SCALE_SUFFIX_PATTERN.test("0.769"), false);
});

test("each scale-suffix allowance class fails when its condition fails", () => {
  const input = readPublisherAttributionScanInput(process.cwd());
  const registry = checkedPublisherAttributionRegistry();
  type RegistryChanges = Partial<ReturnType<typeof checkedPublisherAttributionRegistry>>;
  const scanWith = (changes: RegistryChanges, overrides: Partial<typeof input> = {}) => {
    const variant = { ...registry, ...changes };
    return scanPublisherAttribution({
      ...input,
      ...overrides,
      registry: variant,
      baseline: baselineFromRegistry(
        variant.surfaces,
        variant.readers,
        variant.liveExceptions,
        variant.scaleSuffixAllowances,
      ),
    })
      .map(formatPublisherAttributionIssue)
      .join("\n");
  };
  const withAllowance = (file: string, change: Partial<ScaleSuffixAllowance>) =>
    registry.scaleSuffixAllowances.map((allowance) =>
      allowance.file === file ? { ...allowance, ...change } : allowance,
    );
  const panel = "src/components/conditions/CivicaConditionsPanel.tsx";

  assert.equal(scanWith({}), "");
  assert.match(
    scanWith({ scaleSuffixAllowances: withAllowance(panel, { surfaceIds: [] }) }),
    /\[allowlist-condition-failed\] src\/components\/conditions\/CivicaConditionsPanel\.tsx: a Civica-calculation scale allowance names no surface/,
  );
  assert.match(
    scanWith({ scaleSuffixAllowances: withAllowance(panel, { surfaceIds: ["conditions.components"] }) }),
    /surface conditions\.components is not a disclosed Civica-calculation surface/,
  );
  assert.match(
    scanWith(
      {},
      {
        renderedModuleSources: new Set([
          ...input.renderedModuleSources,
          "src/components/ci/CIPulseScoreDisplay.tsx",
        ]),
      },
    ),
    /CIPulseScoreDisplay\.tsx: may print a scale suffix as not_rendered, but the rendered-module ledger mounts it/,
  );
  const imported = new Map(input.sources);
  imported.set(
    "src/components/example/RetiredScoreCard.tsx",
    'import { CIPulseScoreDisplay } from "@/components/ci/CIPulseScoreDisplay";\nexport const RetiredScoreCard = CIPulseScoreDisplay;\n',
  );
  assert.match(
    scanWith({}, { sources: imported }),
    /CIPulseScoreDisplay\.tsx: is imported by src\/components\/example\/RetiredScoreCard\.tsx, which is not classified not_rendered/,
  );
  const demo = "src/app/design-system/page.tsx";
  const withoutMarker = new Map(input.sources);
  withoutMarker.set(demo, input.sources.get(demo)!.replaceAll("<ValueOriginNote", "<span data-dropped"));
  assert.match(
    scanWith({}, { sources: withoutMarker }),
    /design-system demo no longer shows the ValueOriginNote marker/,
  );
  assert.match(
    scanWith({ scaleSuffixAllowances: withAllowance(demo, { file: "src/app/demo/page.tsx" }) }),
    /\[allowlist-condition-failed\] src\/app\/demo\/page\.tsx: design_system_demo allowances must live under src\/app\/design-system\//,
  );
  const unlisted = scanWith({
    scaleSuffixAllowances: [
      ...registry.scaleSuffixAllowances,
      { file: "src/lib/gone.ts", class: "tooling", note: "fixture", approvedBy: "NOPE" },
    ],
  });
  assert.match(unlisted, /\[scale-suffix-allowance-stale\] src\/lib\/gone\.ts: is in SCALE_SUFFIX_ALLOWANCES but does not exist/);
  assert.match(unlisted, /\[approval-unresolved\] src\/lib\/gone\.ts: approvedBy NOPE does not resolve/);
});

test("the baseline ratchet reports an older schema and a missing list", () => {
  const input = readPublisherAttributionScanInput(process.cwd());
  const current = baselineFromRegistry();
  const older = {
    schemaVersion: "publisher-attribution-baseline/v1",
    exceptions: current.exceptions,
    derivedFieldReaders: current.derivedFieldReaders,
  } as unknown as typeof current;
  const issues = scanPublisherAttribution({ ...input, baseline: older }).map(
    formatPublisherAttributionIssue,
  );
  assert.equal(issues.length, 2, issues.join("\n"));
  assert.match(
    issues[0],
    /^\[registry-baseline-drift\] schemaVersion: the checked baseline is publisher-attribution-baseline\/v1/,
  );
  assert.match(
    issues[1],
    /^\[registry-baseline-drift\] scaleSuffixAllowances: new: src\/app\/design-system\/page\.tsx/,
  );
});
