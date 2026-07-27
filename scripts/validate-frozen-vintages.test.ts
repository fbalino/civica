import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  frozenVintageLiveErrors,
  frozenVintageStaticErrors,
  type FrozenVintageStaticInputs,
} from "./validate-frozen-vintages";

function repositoryInputs(): FrozenVintageStaticInputs {
  return {
    snapshotSource: readFileSync(
      "src/lib/factbook/reconcile/snapshot-vintage.ts",
      "utf8",
    ),
    indexSource: readFileSync("src/lib/ci/calculate-v2.ts", "utf8"),
    legacyMigration: readFileSync(
      "drizzle/migrations/0025_immutable_frozen_vintages.sql",
      "utf8",
    ),
    authoritativeBaseline: readFileSync(
      "drizzle/authoritative/0000_authoritative_baseline.sql",
      "utf8",
    ),
    auditSource: readFileSync("plan/evidence/DAT-023/live-audit.json", "utf8"),
  };
}

test("the checked frozen-vintage source, migrations, and evidence pass", () => {
  assert.deepEqual(frozenVintageStaticErrors(repositoryInputs()), []);
});

test("static validation catches an Atlas conflict update", () => {
  const input = repositoryInputs();
  input.snapshotSource = input.snapshotSource.replace(
    ".onConflictDoNothing()",
    ".onConflictDoUpdate({ set: frozenValue })",
  );
  assert.match(
    frozenVintageStaticErrors(input).join("\n"),
    /Atlas frozen writer still mutates conflicts/,
  );
});

test("static validation catches a missing supersession gate", () => {
  const input = repositoryInputs();
  input.indexSource = input.indexSource.replace(
    "assertSupersession(",
    "removedSupersessionGate(",
  );
  assert.match(
    frozenVintageStaticErrors(input).join("\n"),
    /Index writer lacks assertSupersession/,
  );
});

test("static validation catches drift in the authoritative trigger set", () => {
  const input = repositoryInputs();
  input.authoritativeBaseline = input.authoritativeBaseline.replace(
    "CREATE TRIGGER dat_023_immutable_vintage",
    "CREATE TRIGGER removed_dat_023_immutable_vintage",
  );
  assert.match(
    frozenVintageStaticErrors(input).join("\n"),
    /expected 4 DAT-023 triggers in authoritative baseline, found 3/,
  );
});

test("static validation catches seeded immutable audit drift", () => {
  const input = repositoryInputs();
  input.auditSource = input.auditSource.replace(
    '"versionMismatches": 0',
    '"versionMismatches": 1',
  );
  const errors = frozenVintageStaticErrors(input).join("\n");
  assert.match(errors, /checked audit SHA-256 drifted/);
  assert.match(errors, /checked audit no longer matches/);
});

test("static validation reports malformed audit JSON", () => {
  const input = repositoryInputs();
  input.auditSource = "{";
  assert.match(
    frozenVintageStaticErrors(input).join("\n"),
    /checked audit is not valid JSON/,
  );
});

test("clean live comparison rows pass", () => {
  assert.deepEqual(
    frozenVintageLiveErrors(
      {
        total: 17_506,
        version_mismatches: 0,
        null_hashes: 0,
        hash_mismatches: 0,
      },
      {
        total: 237,
        version_mismatches: 0,
        period_mismatches: 0,
        null_hashes: 0,
        hash_mismatches: 0,
      },
      { n: 4 },
    ),
    [],
  );
});

test("live comparison catches row drift and missing triggers", () => {
  const errors = frozenVintageLiveErrors(
    {
      total: 17_506,
      version_mismatches: 1,
      null_hashes: 0,
      hash_mismatches: 0,
    },
    {
      total: 237,
      version_mismatches: 0,
      period_mismatches: 0,
      null_hashes: 1,
      hash_mismatches: 0,
    },
    { n: 3 },
  ).join("\n");
  assert.match(errors, /Atlas version_mismatches: 1/);
  assert.match(errors, /Index null_hashes: 1/);
  assert.match(errors, /expected 4 live immutable-vintage triggers, found 3/);
});
