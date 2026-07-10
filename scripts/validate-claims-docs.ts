/**
 * Aggregate claims-and-documentation CI gate (CLM-017).
 *
 * Reuses existing focused `npm run validate:*` scripts and the full unit
 * suite rather than duplicating their logic — see
 * `src/lib/ci/claims-docs-gate.ts` for the manifest that maps each check to
 * the Done-when category it satisfies.
 *
 * Before running any real validator, this script re-proves the seeded
 * stale-copy fixtures from the pure gate module in-process: every required
 * category must independently fail the gate when its check fails, and a
 * clean fake run must pass. That guards against a future edit to the
 * orchestration logic silently swallowing a real failure.
 */

import { spawnSync } from "node:child_process";

import {
  CLAIMS_DOCS_GATE_MANIFEST,
  buildSeededFixtures,
  evaluateGate,
  validateManifest,
} from "../src/lib/ci/claims-docs-gate";

function proveSeededFixtures(): void {
  const manifestCheck = validateManifest(CLAIMS_DOCS_GATE_MANIFEST);
  if (!manifestCheck.ok) {
    console.error("FAILED — claims-docs gate manifest is invalid:");
    for (const error of manifestCheck.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const fixtures = buildSeededFixtures(CLAIMS_DOCS_GATE_MANIFEST);
  const problems: string[] = [];

  for (const fixture of fixtures) {
    const evaluation = evaluateGate(CLAIMS_DOCS_GATE_MANIFEST, fixture.results);
    if (evaluation.ok !== fixture.expectedOk) {
      problems.push(
        `fixture "${fixture.label}" expected ok=${fixture.expectedOk} but got ok=${evaluation.ok}`,
      );
      continue;
    }
    if (fixture.expectedFailedCategory && !evaluation.failedCategories.includes(fixture.expectedFailedCategory)) {
      problems.push(
        `fixture "${fixture.label}" did not surface category ${fixture.expectedFailedCategory}`,
      );
    }
  }

  if (problems.length > 0) {
    console.error("FAILED — claims-docs gate orchestration self-check did not fail closed:");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  console.log(
    `Pre-flight: proved ${fixtures.length} orchestration fixtures (1 clean + ${fixtures.length - 1} per-category seeded failures) fail closed. Semantic stale-copy fixtures run in the unit-test child.`,
  );
}

function runCheck(npmScript: string): boolean {
  const result = spawnSync("npm", ["run", npmScript], { stdio: "inherit" });
  return result.status === 0;
}

function main(): void {
  console.log("=== Civica claims-and-documentation gate (CLM-017) ===\n");

  proveSeededFixtures();

  const results: Record<string, boolean> = {};
  for (const check of CLAIMS_DOCS_GATE_MANIFEST.checks) {
    console.log(`\n--- ${check.id} (npm run ${check.npmScript}) ---`);
    console.log(check.description);
    results[check.id] = runCheck(check.npmScript);
  }

  const evaluation = evaluateGate(CLAIMS_DOCS_GATE_MANIFEST, results);

  console.log("\n=== Claims-and-documentation gate report ===");
  for (const check of CLAIMS_DOCS_GATE_MANIFEST.checks) {
    const status = results[check.id] ? "PASS" : "FAIL";
    console.log(`${status} — ${check.id} [${check.categories.join(", ")}]`);
  }

  if (!evaluation.ok) {
    console.error(
      `\nFAILED — ${evaluation.failedChecks.length} check(s) failed: ${evaluation.failedChecks.join(", ")}`,
    );
    console.error(`Affected categories: ${evaluation.failedCategories.join(", ")}`);
    process.exit(1);
  }

  console.log("\nPASS — all claims-and-documentation checks passed across all seven categories.");
}

main();
