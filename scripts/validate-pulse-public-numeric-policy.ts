import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY,
  buildPulseNumericPublicationPolicy,
} from "../src/lib/pulse/v2/public-numeric-policy";
import { CURRENT_PULSE_RUNTIME_METHOD } from "../src/lib/pulse/v2/runtime-contract";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function includesAll(
  relativePath: string,
  required: readonly string[],
): void {
  const source = read(relativePath);
  for (const fragment of required) {
    assert.ok(
      source.includes(fragment),
      `${relativePath} is missing required PUL-001 fragment: ${fragment}`,
    );
  }
}

function excludesAll(
  relativePath: string,
  prohibited: readonly RegExp[],
): void {
  const source = read(relativePath);
  for (const pattern of prohibited) {
    assert.doesNotMatch(
      source,
      pattern,
      `${relativePath} contains prohibited PUL-001 language: ${pattern}`,
    );
  }
}

const policy = CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY;
assert.equal(policy.mode, "api_only_experimental");
assert.equal(policy.methodVersion, CURRENT_PULSE_RUNTIME_METHOD.version);
assert.equal(policy.publicStatus, "public_experimental");
assert.equal(
  policy.publicStatus,
  CURRENT_PULSE_RUNTIME_METHOD.numericDeltas.publicStatus,
);
assert.deepEqual(policy.surfaces, {
  ui: false,
  api: true,
  bulkExport: false,
});
assert.equal(policy.limitations.length, 3);
assert.equal(
  CURRENT_PULSE_RUNTIME_METHOD.evaluation
    .currentProductionValidatedByExistingBacktest,
  false,
);

const omitted = buildPulseNumericPublicationPolicy(
  "omit",
  CURRENT_PULSE_RUNTIME_METHOD.version,
);
assert.deepEqual(omitted.surfaces, {
  ui: false,
  api: false,
  bulkExport: false,
});
assert.equal(omitted.publicStatus, "omitted_pending_validation");

includesAll("src/components/pulse/PulseDimensionalDeltas.tsx", [
  "CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.label",
  "CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.methodVersion",
  "not a validated measure of governance change",
  "not comparable country scores or rankings",
  "/civica-index/methodology/pulse#known-limitations",
]);

// The hardened panel remains as preserved code, but no reader route mounts it.
// Reviving it requires a new public policy version rather than an import alone.
excludesAll("src/app/(reader)/country/[slug]/civica-data/page.tsx", [
  /PulseDimensionalDeltas/,
  /CivicaIndexPanel/,
]);

includesAll("src/lib/api/helpers.ts", [
  "version: CURRENT_PULSE_RUNTIME_METHOD.version",
  "CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.publicStatus",
  "scalar_pulse_score: false",
  "currentProductionValidatedByExistingBacktest",
  "externalValidation",
]);

includesAll(
  "src/app/(reader)/civica-index/methodology/pulse/page.tsx",
  [
    '"civica:pulse-numeric-policy"',
    '"civica:methodology-version"',
    '"civica:numeric-standing"',
    "published only as experimental heuristics",
    "have not completed independent review",
  ],
);

includesAll("content/methodology-pulse.md", [
  "experimental per-dimension deltas",
  "{{ctx.methodologyVersion}}",
  "Not an established measurement",
  "have not completed independent review",
]);

includesAll("README.template.md", [
  "Numeric effects are API-only experimental, named per-dimension deltas",
  "reader pages and bulk exports omit them",
  "does not publish a merged Pulse score or Pulse ranking",
  "has not completed representative evaluation or independent review",
]);

// Bulk country downloads deliberately exclude Pulse numeric effects. The API
// endpoint above is the only public machine-readable numeric surface.
excludesAll("src/app/api/countries/[slug]/export/route.ts", [
  /pulse_dimensional_deltas/i,
  /pulseDailyScores/,
  /pulseScore/,
]);

for (const relativePath of [
  "README.template.md",
  "content/methodology-pulse.md",
  "src/app/(reader)/civica-index/methodology/pulse/page.tsx",
  "src/components/pulse/PulseDimensionalDeltas.tsx",
  "src/lib/api/contract/registry.ts",
]) {
  excludesAll(relativePath, [
    /validated daily governance change/i,
    /validated governance (?:score|measure)/i,
    /Pulse (?:country )?ranking (?:orders|ranks|compares) countries/i,
  ]);
}

console.log(
  `PASS — ${policy.id} keeps Pulse numeric effects method-bound, API-only, visibly heuristic, limitation-qualified, non-scalar, and absent from reader UI and bulk exports; the omit policy remains executable and snapshot-tested.`,
);
