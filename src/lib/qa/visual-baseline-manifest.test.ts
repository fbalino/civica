import assert from "node:assert/strict";
import test from "node:test";

import {
  VISUAL_BASELINE_MANIFEST_SCHEMA,
  expectedVisualBaselines,
  visualBaselineManifestErrors,
  type VisualBaselineManifest,
} from "./visual-baseline-manifest";

function manifest(
  overrides: Partial<VisualBaselineManifest> = {},
): VisualBaselineManifest {
  const platform = "darwin";
  const browserProject = "chromium";
  return {
    schemaVersion: VISUAL_BASELINE_MANIFEST_SCHEMA,
    status: "candidate",
    generatedAt: "2026-07-18T00:00:00.000Z",
    platform,
    inputContractSha256: "a".repeat(64),
    candidate: {
      author: "Codex",
      reason: "Capture a review candidate.",
      createdAt: "2026-07-18T00:00:00.000Z",
    },
    records: expectedVisualBaselines().map((record) => ({
      ...record,
      browserProject,
      path: `${record.caseId}-${browserProject}-${platform}.png`,
      sha256: "b".repeat(64),
    })),
    ...overrides,
  };
}

test("a complete candidate manifest remains valid until approval is required", () => {
  assert.deepEqual(
    visualBaselineManifestErrors(manifest(), undefined, { requireApproved: false }),
    [],
  );
  assert.ok(
    visualBaselineManifestErrors(manifest(), undefined, { requireApproved: true }).includes(
      "baseline manifest is not approved",
    ),
  );
});

test("an approved manifest needs a reviewer, reason, and approval time", () => {
  assert.ok(
    visualBaselineManifestErrors(
      manifest({ status: "approved" }),
      undefined,
      { requireApproved: true },
    ).length >= 3,
  );
});

test("a baseline cannot omit or impersonate a required visual surface", () => {
  const incomplete = manifest({ records: manifest().records.slice(1) });
  assert.ok(
    visualBaselineManifestErrors(incomplete, undefined, { requireApproved: false }).some(
      (error) => error.includes("missing required baseline: design-system-light-desktop"),
    ),
  );

  const invalid = manifest({
    records: [
      ...manifest().records.slice(0, -1),
      {
        ...manifest().records.at(-1)!,
        caseId: "unregistered-light-desktop",
      },
    ],
  });
  assert.ok(
    visualBaselineManifestErrors(invalid, undefined, { requireApproved: false }).some(
      (error) => error.includes("does not map to a registered scenario")),
  );
});
