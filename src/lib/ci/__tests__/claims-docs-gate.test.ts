import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  CLAIMS_DOCS_GATE_MANIFEST,
  REQUIRED_CATEGORIES,
  buildSeededFixtures,
  evaluateGate,
  validateManifest,
  type GateManifest,
} from "../claims-docs-gate";

test("the real manifest covers every required category with no duplicates", () => {
  const result = validateManifest(CLAIMS_DOCS_GATE_MANIFEST);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("validateManifest rejects a duplicate check id", () => {
  const check = CLAIMS_DOCS_GATE_MANIFEST.checks[0];
  const manifest: GateManifest = {
    checks: [check, { ...check }],
  };
  const result = validateManifest(manifest);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("duplicate check id")),
  );
});

test("validateManifest rejects a missing required category", () => {
  const manifest: GateManifest = {
    checks: CLAIMS_DOCS_GATE_MANIFEST.checks.filter(
      (check) => !check.categories.includes("terminology-policy"),
    ),
  };
  const result = validateManifest(manifest);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) =>
      error.includes("no check covers required category: terminology-policy"),
    ),
  );
});

test("validateManifest rejects a check with no categories", () => {
  const manifest: GateManifest = {
    checks: [
      { id: "orphan", npmScript: "noop", categories: [], description: "" },
    ],
  };
  const result = validateManifest(manifest);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes("declares no categories")),
  );
});

test("validateManifest rejects a check referencing an unknown category", () => {
  const manifest: GateManifest = {
    checks: [
      {
        id: "bogus",
        npmScript: "noop",
        categories: ["not-a-real-category" as never],
        description: "",
      },
    ],
  };
  const result = validateManifest(manifest);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("unknown category")));
});

test("evaluateGate passes a clean fake run", () => {
  const results: Record<string, boolean> = {};
  for (const check of CLAIMS_DOCS_GATE_MANIFEST.checks)
    results[check.id] = true;

  const evaluation = evaluateGate(CLAIMS_DOCS_GATE_MANIFEST, results);
  assert.equal(evaluation.ok, true);
  assert.deepEqual(evaluation.failedChecks, []);
  assert.deepEqual(evaluation.failedCategories, []);
});

test("evaluateGate fails closed on a missing result", () => {
  const results: Record<string, boolean> = {};
  for (const check of CLAIMS_DOCS_GATE_MANIFEST.checks)
    results[check.id] = true;
  delete results[CLAIMS_DOCS_GATE_MANIFEST.checks[0].id];

  const evaluation = evaluateGate(CLAIMS_DOCS_GATE_MANIFEST, results);
  assert.equal(evaluation.ok, false);
  assert.ok(
    evaluation.missingResults.includes(CLAIMS_DOCS_GATE_MANIFEST.checks[0].id),
  );
});

test("every required category has a seeded stale-copy fixture that fails the gate", () => {
  const fixtures = buildSeededFixtures(CLAIMS_DOCS_GATE_MANIFEST);
  const categoriesCovered = new Set(
    fixtures
      .filter((fixture) => !fixture.expectedOk)
      .map((fixture) => fixture.expectedFailedCategory),
  );

  assert.equal(categoriesCovered.size, REQUIRED_CATEGORIES.length);
  for (const category of REQUIRED_CATEGORIES) {
    assert.ok(
      categoriesCovered.has(category),
      `missing seeded fixture for ${category}`,
    );
    const fixture = fixtures.find(
      (candidate) => candidate.expectedFailedCategory === category,
    );
    assert.ok(
      fixture?.semanticFixtureEvidence,
      `missing semantic fixture evidence for ${category}`,
    );
  }
});

test("seeded fixtures match evaluateGate's actual verdict — orchestration cannot swallow a failure", () => {
  const fixtures = buildSeededFixtures(CLAIMS_DOCS_GATE_MANIFEST);

  for (const fixture of fixtures) {
    const evaluation = evaluateGate(CLAIMS_DOCS_GATE_MANIFEST, fixture.results);
    assert.equal(
      evaluation.ok,
      fixture.expectedOk,
      `fixture "${fixture.label}" verdict mismatch`,
    );
    if (fixture.expectedFailedCategory) {
      assert.ok(
        evaluation.failedCategories.includes(fixture.expectedFailedCategory),
        `fixture "${fixture.label}" did not surface category ${fixture.expectedFailedCategory}`,
      );
    }
  }
});

test("a single seeded failure never silently passes the gate as a whole", () => {
  const fixtures = buildSeededFixtures(CLAIMS_DOCS_GATE_MANIFEST).filter(
    (fixture) => !fixture.expectedOk,
  );
  assert.ok(fixtures.length > 0);
  for (const fixture of fixtures) {
    const evaluation = evaluateGate(CLAIMS_DOCS_GATE_MANIFEST, fixture.results);
    assert.equal(evaluation.ok, false);
    assert.ok(evaluation.failedChecks.length > 0);
  }
});

test("package scripts expose the aggregate gate and shared build core calls it once", () => {
  const pkg = JSON.parse(
    readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };
  assert.equal(
    pkg.scripts["validate:claims-docs"],
    "tsx scripts/validate-claims-docs.ts",
  );
  const matches =
    pkg.scripts["build:core"].match(/validate:claims-docs/g) ?? [];
  assert.equal(matches.length, 1);
});
