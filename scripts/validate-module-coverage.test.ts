/**
 * QA-002 — seeded-coverage-regression proof.
 *
 * "Done when" requires that a seeded coverage regression FAILS the gate.
 * This test builds two tiny fixture module+test pairs in a scratch
 * directory under the repo (so `tsx`/`node --test` resolves them exactly
 * like real project files) — one fully covered, one deliberately
 * under-covered — and asserts `runModuleCoverage()` (the exact function
 * `validate-module-coverage.ts`'s CLI uses per module) PASSES the first
 * and FAILS the second under the same thresholds. This is the mechanism
 * proof: it demonstrates the checker actually enforces the declared
 * per-module floor rather than always reporting success.
 *
 * Both fixtures share one source module; only the amount of test
 * exercise differs. Node's coverage report only reliably resolves partial
 * coverage on `functions` and `branch` for very small standalone modules
 * (an observed quirk of running `--experimental-test-coverage` through
 * `tsx`'s esbuild-based CJS transform — `lines` coverage on tiny files can
 * round up misleadingly for reasons unrelated to real project modules,
 * which is exactly why QA-002 measured real per-module baselines rather
 * than assuming numbers), so the fixture and thresholds below are chosen
 * to produce a reliable, reproducible gap on those two axes.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  runModuleCoverage,
  parseAllFilesRow,
  formatResultsTable,
  type ModuleCoverageConfig,
} from "./validate-module-coverage";

const REPO_ROOT = join(__dirname, "..");

const FIXTURE_MODULE_SOURCE = `/**
 * QA-002 seeded-regression fixture. Not part of the application — built
 * at test time by validate-module-coverage.test.ts and deleted afterward.
 */

const KNOWN_TAGS = new Set(["low", "medium", "high", "critical"]);

/**
 * Classify a free-text severity tag into a normalized bucket. Returns
 * \`null\` for anything not in the known vocabulary.
 */
export function classifySeverity(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim().toLowerCase();

  if (!trimmed) return null;

  if (KNOWN_TAGS.has(trimmed)) return trimmed;

  // A few common aliases worth normalizing before giving up.
  if (trimmed === "sev1" || trimmed === "p0") return "critical";
  if (trimmed === "sev2" || trimmed === "p1") return "high";

  return null;
}

/**
 * Exercised by the "well covered" fixture test, skipped entirely by the
 * "under covered" one — the function-coverage axis's real regression.
 */
export function describeSeverity(tag: string): string {
  switch (tag) {
    case "critical":
      return "Drop everything.";
    case "high":
      return "Fix this sprint.";
    default:
      return "Track it.";
  }
}
`;

const WELL_COVERED_TEST_SOURCE = `import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySeverity, describeSeverity } from "./severity";

test("classifySeverity handles the full grammar", () => {
  assert.equal(classifySeverity(null), null);
  assert.equal(classifySeverity(""), null);
  assert.equal(classifySeverity("   "), null);
  assert.equal(classifySeverity("HIGH"), "high");
  assert.equal(classifySeverity("sev1"), "critical");
  assert.equal(classifySeverity("p0"), "critical");
  assert.equal(classifySeverity("sev2"), "high");
  assert.equal(classifySeverity("p1"), "high");
  assert.equal(classifySeverity("unknown-tag"), null);
});

test("describeSeverity covers every branch", () => {
  assert.equal(describeSeverity("critical"), "Drop everything.");
  assert.equal(describeSeverity("high"), "Fix this sprint.");
  assert.equal(describeSeverity("low"), "Track it.");
});
`;

const UNDER_COVERED_TEST_SOURCE = `import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySeverity } from "./severity";

// Deliberately minimal: exercises exactly one branch of one of the two
// exported functions, and never calls describeSeverity at all. This is
// the seeded regression QA-002 requires — it must fail the same
// thresholds the well-covered fixture passes.
test("classifySeverity - single trivial case only", () => {
  assert.equal(classifySeverity(null), null);
});
`;

// A threshold band chosen to sit strictly between the two fixtures'
// measured branch/functions coverage (verified empirically while building
// this test; see the module docblock above for why `lines` isn't used as
// a discriminator here).
const SHARED_THRESHOLDS = { lines: 90, branch: 90, functions: 95 };

test("seeded coverage regression: the checker passes a well-covered module and fails an under-covered one", (t) => {
  const scratchDir = mkdtempSync(join(REPO_ROOT, "scripts", ".qa002-coverage-fixture-"));
  t.after(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  const scratchRel = scratchDir.slice(REPO_ROOT.length + 1); // already "scripts/.qa002-..."
  const moduleRelPath = join(scratchRel, "severity.ts");
  const wellTestRelPath = join(scratchRel, "well.test.ts");
  const underTestRelPath = join(scratchRel, "under.test.ts");

  writeFileSync(join(scratchDir, "severity.ts"), FIXTURE_MODULE_SOURCE);
  writeFileSync(join(scratchDir, "well.test.ts"), WELL_COVERED_TEST_SOURCE);
  writeFileSync(join(scratchDir, "under.test.ts"), UNDER_COVERED_TEST_SOURCE);

  const wellConfig: ModuleCoverageConfig = {
    name: "qa002-fixture-well-covered",
    testGlobs: [wellTestRelPath],
    includeGlobs: [moduleRelPath],
    thresholds: SHARED_THRESHOLDS,
  };
  const underConfig: ModuleCoverageConfig = {
    name: "qa002-fixture-under-covered",
    testGlobs: [underTestRelPath],
    includeGlobs: [moduleRelPath],
    thresholds: SHARED_THRESHOLDS,
  };

  const wellResult = runModuleCoverage(wellConfig, { cwd: REPO_ROOT });
  const underResult = runModuleCoverage(underConfig, { cwd: REPO_ROOT });

  // The well-covered fixture must PASS.
  assert.equal(
    wellResult.exitCode,
    0,
    `expected the well-covered fixture to exit 0, got ${wellResult.exitCode}. Output:\n${wellResult.output}`,
  );
  assert.equal(wellResult.passed, true);
  assert.ok(
    wellResult.measured.functions !== null && wellResult.measured.functions >= SHARED_THRESHOLDS.functions,
    `expected well-covered functions% >= ${SHARED_THRESHOLDS.functions}, got ${wellResult.measured.functions}`,
  );

  // The under-covered fixture — same module, same thresholds, far less
  // test exercise — must FAIL. This is the actual regression assertion.
  assert.notEqual(
    underResult.exitCode,
    0,
    `expected the under-covered fixture to fail the gate (nonzero exit), got 0. Output:\n${underResult.output}`,
  );
  assert.equal(underResult.passed, false);
  assert.ok(
    underResult.measured.functions !== null && underResult.measured.functions < SHARED_THRESHOLDS.functions,
    `expected under-covered functions% < ${SHARED_THRESHOLDS.functions}, got ${underResult.measured.functions}`,
  );

  // The two runs must actually have measured DIFFERENT coverage — proves
  // this isn't a fixed pass/fail baked into the harness.
  assert.notEqual(wellResult.measured.functions, underResult.measured.functions);
});

test("runModuleCoverage reports a coherent module-scoped result shape (not a global blob)", (t) => {
  const scratchDir = mkdtempSync(join(REPO_ROOT, "scripts", ".qa002-coverage-fixture-"));
  t.after(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });
  writeFileSync(join(scratchDir, "severity.ts"), FIXTURE_MODULE_SOURCE);
  writeFileSync(join(scratchDir, "well.test.ts"), WELL_COVERED_TEST_SOURCE);

  const scratchRel = scratchDir.slice(REPO_ROOT.length + 1); // already "scripts/.qa002-..."
  const moduleRelPath = join(scratchRel, "severity.ts");
  const testRelPath = join(scratchRel, "well.test.ts");

  const config: ModuleCoverageConfig = {
    name: "qa002-fixture-shape-check",
    testGlobs: [testRelPath],
    includeGlobs: [moduleRelPath],
    thresholds: { lines: 1, branch: 1, functions: 1 },
  };
  const result = runModuleCoverage(config, { cwd: REPO_ROOT });

  assert.equal(result.name, "qa002-fixture-shape-check");
  assert.equal(result.passed, true);
  assert.equal(typeof result.measured.lines, "number");
  assert.equal(typeof result.measured.branch, "number");
  assert.equal(typeof result.measured.functions, "number");
  assert.deepEqual(result.thresholds, { lines: 1, branch: 1, functions: 1 });
});

// ─── Unit coverage of the small pure helpers ────────────────────────────

test("parseAllFilesRow extracts the aggregate percentages from a real report", () => {
  const sample = [
    "ℹ start of coverage report",
    "ℹ file       | line % | branch % | funcs % | uncovered lines",
    "ℹ mod.ts     |  92.89 |    90.48 |   79.17 | 12-14",
    "ℹ all files  |  92.89 |    90.48 |   79.17 | ",
    "ℹ end of coverage report",
  ].join("\n");
  assert.deepEqual(parseAllFilesRow(sample), {
    lines: 92.89,
    branch: 90.48,
    functions: 79.17,
  });
});

test("parseAllFilesRow returns nulls when no coverage report was printed", () => {
  assert.deepEqual(parseAllFilesRow("no coverage report here, e.g. a crash"), {
    lines: null,
    branch: null,
    functions: null,
  });
});

test("formatResultsTable renders one row per result with PASS/FAIL status", () => {
  const table = formatResultsTable([
    {
      name: "sample-module",
      passed: true,
      exitCode: 0,
      measured: { lines: 100, branch: 90, functions: 80 },
      thresholds: { lines: 90, branch: 80, functions: 70 },
      output: "",
    },
    {
      name: "regressed-module",
      passed: false,
      exitCode: 1,
      measured: { lines: 50, branch: 40, functions: 30 },
      thresholds: { lines: 90, branch: 80, functions: 70 },
      output: "",
    },
  ]);
  assert.match(table, /sample-module.*PASS/);
  assert.match(table, /regressed-module.*FAIL/);
});
