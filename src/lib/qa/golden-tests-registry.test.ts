/**
 * QA-007 — registry / validator negative + positive tests.
 *
 * Proves that `goldenTestsRegistryErrors`:
 *   1. passes against the real repository (all registered files present,
 *      all subtopics covered, all protected transforms registered);
 *   2. FAILS when a registered golden test file is missing on disk
 *      (the seeded-failure requirement);
 *   3. FAILS when a subtopic is dropped or a protected transform is not
 *      registered in the Index change-control net.
 *
 * DB-free and filesystem-real for the positive case, stubbed for the
 * negative cases.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  GOLDEN_SUBTOPICS,
  GOLDEN_TESTS_REGISTRY,
  goldenTestsRegistryErrors,
  protectedTransformPaths,
} from "./golden-tests-registry";

test("registry passes against the real repository", () => {
  const errors = goldenTestsRegistryErrors(GOLDEN_TESTS_REGISTRY, { fileExists: existsSync });
  assert.deepEqual(errors, [], `expected no registry errors, got:\n${errors.join("\n")}`);
});

test("every subtopic has exactly one entry", () => {
  assert.equal(GOLDEN_TESTS_REGISTRY.length, GOLDEN_SUBTOPICS.length);
  const covered = new Set(GOLDEN_TESTS_REGISTRY.map((e) => e.subtopic));
  for (const subtopic of GOLDEN_SUBTOPICS) assert.ok(covered.has(subtopic), `uncovered subtopic: ${subtopic}`);
});

test("seeded failure: a missing registered golden test file is detected", () => {
  // Pick the first registered test file and pretend it vanished from disk.
  const victim = GOLDEN_TESTS_REGISTRY[0].testFiles[0];
  const fileExists = (path: string) => path !== victim && existsSync(path);
  const errors = goldenTestsRegistryErrors(GOLDEN_TESTS_REGISTRY, { fileExists });
  assert.ok(
    errors.some((e) => e.includes("registered golden test file is missing") && e.includes(victim)),
    `expected a missing-file error for ${victim}, got:\n${errors.join("\n")}`,
  );
});

test("seeded failure: a dropped subtopic is detected", () => {
  const truncated = GOLDEN_TESTS_REGISTRY.slice(1); // drop the first subtopic
  const errors = goldenTestsRegistryErrors(truncated, { fileExists: existsSync });
  assert.ok(
    errors.some((e) => e.includes("missing golden coverage for subtopic")),
    `expected a missing-subtopic error, got:\n${errors.join("\n")}`,
  );
});

test("seeded failure: an unregistered protected transform is detected", () => {
  // Same registry, but pretend the Index change-control net protects nothing.
  const errors = goldenTestsRegistryErrors(GOLDEN_TESTS_REGISTRY, {
    fileExists: existsSync,
    protectedPaths: new Set<string>(),
  });
  assert.ok(
    errors.some((e) => e.includes("not registered in the Index change-control net")),
    `expected an unregistered-transform error, got:\n${errors.join("\n")}`,
  );
});

test("the real protected-transform set actually contains the registered Index transforms", () => {
  const protectedPaths = protectedTransformPaths();
  assert.ok(protectedPaths.has("src/lib/ci/normalize-v2.ts"));
  assert.ok(protectedPaths.has("src/lib/ci/tournament-baselines.ts"));
  assert.ok(protectedPaths.has("src/lib/pulse/v2/score.ts"));
});
