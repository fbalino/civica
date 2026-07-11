import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  indexChangeControlErrors,
  indexSnapshotSha256,
  requiredIndexValidations,
  unclassifiedIndexSemanticFiles,
  type IndexChangeRegistry,
} from "./index-change-control";

const registry = JSON.parse(readFileSync("data/releases/index-change-control-v1/registry.v1.json", "utf8")) as IndexChangeRegistry;

test("current Index change-control baseline is complete", () => {
  assert.deepEqual(indexChangeControlErrors(registry), []);
  assert.deepEqual(unclassifiedIndexSemanticFiles(), []);
});

test("protected semantic drift requires an appended versioned record", () => {
  const drifted = structuredClone(registry.entries.at(-1)!.protectedFiles);
  drifted[0].sha256 = "a".repeat(64);
  assert.ok(indexChangeControlErrors(registry, drifted).includes("protected Index files changed without a new change record"));
});

test("a future record cannot reuse unchanged docs, registry, notes, migration, or tests", () => {
  const next = structuredClone(registry) as IndexChangeRegistry;
  const prior = next.entries.at(-1)!;
  const protectedFiles = structuredClone(prior.protectedFiles);
  protectedFiles[0].sha256 = "b".repeat(64);
  const entry = {
    ...structuredClone(prior),
    id: "fixture-future-change",
    fromVersion: prior.toVersion,
    toVersion: "fixture-v2",
    parentSnapshotSha256: prior.snapshotSha256,
    snapshotSha256: indexSnapshotSha256(protectedFiles),
    categories: [protectedFiles[0].category],
    changedPaths: [protectedFiles[0].path],
    protectedFiles,
    validations: requiredIndexValidations([protectedFiles[0].category]),
  };
  next.entries.push(entry);
  next.currentSnapshotSha256 = entry.snapshotSha256;
  const errors = indexChangeControlErrors(next, protectedFiles);
  for (const role of ["documentation", "registry", "release_note", "migration_plan", "golden_test", "contract_test"]) {
    assert.ok(errors.includes(`fixture-future-change: ${role} was not updated`));
  }
});

test("version and validation sets fail closed", () => {
  const broken = structuredClone(registry) as IndexChangeRegistry;
  broken.entries[0].toVersion = broken.entries[0].fromVersion;
  broken.entries[0].validations = [];
  const errors = indexChangeControlErrors(broken, broken.entries[0].protectedFiles);
  assert.ok(errors.some((error) => error.includes("methodology version did not advance")));
  assert.ok(errors.some((error) => error.includes("declared validation set is incomplete")));
});

test("future model changes require a new version-specific validator", () => {
  const next = structuredClone(registry) as IndexChangeRegistry;
  const prior = next.entries.at(-1)!;
  const protectedFiles = structuredClone(prior.protectedFiles);
  const modelIndex = protectedFiles.findIndex((row) => row.category === "weight_or_model");
  protectedFiles[modelIndex].sha256 = "c".repeat(64);
  const entry = {
    ...structuredClone(prior),
    id: "fixture-model-change",
    fromVersion: prior.toVersion,
    toVersion: "fixture-model-v2",
    parentSnapshotSha256: prior.snapshotSha256,
    snapshotSha256: indexSnapshotSha256(protectedFiles),
    categories: ["weight_or_model" as const],
    changedPaths: [protectedFiles[modelIndex].path],
    protectedFiles,
    validations: requiredIndexValidations(["weight_or_model"]),
  };
  next.entries.push(entry);
  next.currentSnapshotSha256 = entry.snapshotSha256;
  assert.ok(
    indexChangeControlErrors(next, protectedFiles).includes(
      "fixture-model-change: model/transform change lacks a new version-specific Index validator",
    ),
  );
});
