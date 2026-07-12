/**
 * QA-007 — golden-test registry validator.
 *
 * Reads `src/lib/qa/golden-tests-registry.ts` and asserts, against the real
 * filesystem, that:
 *   - the schema version is current;
 *   - all eight published-calculation subtopics have golden coverage;
 *   - every registered golden test file and source-of-truth module exists;
 *   - every declared protected transform is registered in the Index
 *     change-control net.
 *
 * Pure / DB-free — no database, network, or secrets. Runs in the build
 * chain and as part of `validate:golden-tests`.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  GOLDEN_SUBTOPICS,
  GOLDEN_TESTS_REGISTRY,
  GOLDEN_TESTS_SCHEMA_VERSION,
  goldenTestsRegistryErrors,
} from "../src/lib/qa/golden-tests-registry";

function main(): void {
  assert.equal(
    GOLDEN_TESTS_SCHEMA_VERSION,
    "civica-golden-tests/v1",
    "golden-tests schema version drifted",
  );

  const errors = goldenTestsRegistryErrors(GOLDEN_TESTS_REGISTRY, { fileExists: existsSync });
  if (errors.length > 0) {
    console.error("FAIL — golden-test registry has integrity errors:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const testFileCount = new Set(GOLDEN_TESTS_REGISTRY.flatMap((entry) => entry.testFiles)).size;
  console.log(
    `PASS — ${GOLDEN_SUBTOPICS.length}/${GOLDEN_SUBTOPICS.length} published-calculation subtopics ` +
      `carry deterministic golden coverage across ${testFileCount} test files; ` +
      `every source-of-truth module and protected transform is registered.`,
  );
}

main();
