import assert from "node:assert/strict";
import test from "node:test";
import {
  monetizationGateErrors,
  nonCommercialSources,
  isCommercialPosture,
} from "./monetization-gate";
import type { SourceRightsRecord } from "./manifest";

const NC: SourceRightsRecord = {
  sourceId: "constitute_project",
  licenseId: "CC-BY-NC-3.0",
  termsUrl: "https://x",
  reviewStatus: "verified",
  publicExport: "non-commercial-only",
  commercialUse: false,
  requiredNotices: [],
} as unknown as SourceRightsRecord;

const OPEN: SourceRightsRecord = {
  sourceId: "world_bank",
  licenseId: "CC-BY-4.0",
  termsUrl: "https://x",
  reviewStatus: "verified",
  publicExport: "allowed",
  commercialUse: true,
  requiredNotices: [],
} as unknown as SourceRightsRecord;

test("the real manifest lists the known non-commercial sources", () => {
  const ids = nonCommercialSources().map((r) => r.sourceId);
  assert.ok(ids.length >= 1);
  // Constitute is the currently-verified NC source.
  assert.ok(ids.includes("constitute_project"), `NC ids: ${ids.join(",")}`);
});

test("non-commercial posture (default) passes", () => {
  assert.deepEqual(monetizationGateErrors({}, [NC, OPEN]), []);
  assert.equal(isCommercialPosture({}), false);
});

test("commercial posture with an NC source FAILS the gate", () => {
  const errors = monetizationGateErrors(
    { CIVICA_COMMERCIAL_DEPLOYMENT: "true" },
    [NC, OPEN],
  );
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => e.includes("constitute_project")));
});

test("fee-bearing posture also trips the gate", () => {
  const errors = monetizationGateErrors(
    { CIVICA_FEE_BEARING_ACCESS: "true" },
    [NC],
  );
  assert.ok(errors.length > 0);
});

test("commercial posture with NO NC sources passes (post-relicensing)", () => {
  assert.deepEqual(
    monetizationGateErrors({ CIVICA_COMMERCIAL_DEPLOYMENT: "true" }, [OPEN]),
    [],
  );
});
