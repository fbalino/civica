import assert from "node:assert/strict";
import test from "node:test";
import { assertExternalSyncSucceeded } from "./external-sync-outcome";

test("external sync outcome accepts a positive clean apply or dry-run plan", () => {
  assert.doesNotThrow(() => assertExternalSyncSucceeded("fixture", { totalWritten: 1, errors: [] }));
  assert.doesNotThrow(() => assertExternalSyncSucceeded("fixture", { totalWritten: 2, errors: [], dryRun: true }));
});

test("external sync outcome fails loudly on malformed, partial, or empty results", () => {
  assert.throws(() => assertExternalSyncSucceeded("fixture", { totalWritten: 2, errors: ["schema changed"] }), /schema changed/);
  assert.throws(() => assertExternalSyncSucceeded("fixture", { totalWritten: 0, errors: [] }), /zero usable rows/);
  assert.throws(() => assertExternalSyncSucceeded("fixture", { totalWritten: Number.NaN, errors: [] }), /zero usable rows/);
});
