import { createHash } from "node:crypto";

import type { NeonTargetReport } from "@/lib/qa/neon-target";

import type { ConditionsDimension } from "./contract";
import {
  conditionsReleaseValidationExpectationErrors,
  type ConditionsReleaseValidationExpectations,
} from "./release-live-validation";

export const CONDITIONS_RELEASE_EXPECTATIONS_CONTRACT =
  "civica-conditions-release-expectations/v1" as const;

export interface ConditionsReleaseExpectationsArtifact
  extends ConditionsReleaseValidationExpectations {
  contract: typeof CONDITIONS_RELEASE_EXPECTATIONS_CONTRACT;
  releaseId: string;
  databaseTarget: NeonTargetReport;
}

const TOP_LEVEL_KEYS = [
  "contract",
  "releaseId",
  "releaseManifestSha256",
  "expectedCalculationCounts",
  "databaseTarget",
] as const;

const TARGET_KEYS = [
  "projectId",
  "branchId",
  "endpointId",
  "hostnameSha256",
  "migrationHead",
  "ledgerPresent",
  "writesPerformed",
] as const;

const COUNT_KEYS: ConditionsDimension[] = [
  "human_development",
  "peace_security",
  "economic_stability",
];

function record(value: unknown, error: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(error);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  error: string,
): void {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    throw new Error(error);
  }
}

function requiredText(value: unknown, error: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(error);
  return value.trim();
}

export function conditionsReleaseExpectationsArtifactSha256(
  serialized: string,
): string {
  return createHash("sha256").update(serialized).digest("hex");
}

export function serializeConditionsReleaseExpectationsArtifact(
  artifact: ConditionsReleaseExpectationsArtifact,
): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export function createConditionsReleaseExpectationsArtifact(input: {
  releaseId: string;
  releaseManifestSha256: string;
  expectedCalculationCounts: Readonly<Record<ConditionsDimension, number>>;
  databaseTarget: NeonTargetReport;
}): ConditionsReleaseExpectationsArtifact {
  return parseConditionsReleaseExpectationsArtifact(
    serializeConditionsReleaseExpectationsArtifact({
      contract: CONDITIONS_RELEASE_EXPECTATIONS_CONTRACT,
      ...input,
      expectedCalculationCounts: { ...input.expectedCalculationCounts },
      databaseTarget: { ...input.databaseTarget },
    }),
  );
}

export function parseConditionsReleaseExpectationsArtifact(
  serialized: string,
): ConditionsReleaseExpectationsArtifact {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Conditions expectations artifact is not valid JSON");
  }
  const value = record(
    parsed,
    "Conditions expectations artifact must be an object",
  );
  exactKeys(
    value,
    TOP_LEVEL_KEYS,
    "Conditions expectations artifact has an open or incomplete shape",
  );
  if (value.contract !== CONDITIONS_RELEASE_EXPECTATIONS_CONTRACT) {
    throw new Error("Conditions expectations artifact contract is invalid");
  }
  const releaseId = requiredText(
    value.releaseId,
    "Conditions expectations release ID is required",
  );
  if (!/^conditions-[a-z0-9-]+-v[1-9][0-9]*$/.test(releaseId)) {
    throw new Error("Conditions expectations release ID is invalid");
  }

  const countsValue = record(
    value.expectedCalculationCounts,
    "Conditions expectations counts are required",
  );
  exactKeys(
    countsValue,
    COUNT_KEYS,
    "Conditions expectations counts have an open or incomplete shape",
  );
  const expectedCalculationCounts = Object.fromEntries(
    COUNT_KEYS.map((dimension) => [dimension, countsValue[dimension]]),
  ) as Record<ConditionsDimension, number>;
  const releaseManifestSha256 = requiredText(
    value.releaseManifestSha256,
    "Conditions expectations manifest hash is required",
  );
  const expectationErrors = conditionsReleaseValidationExpectationErrors({
    releaseManifestSha256,
    expectedCalculationCounts,
  });
  if (expectationErrors.length) {
    throw new Error(`Conditions expectations are invalid: ${expectationErrors.join("; ")}`);
  }

  const targetValue = record(
    value.databaseTarget,
    "Conditions expectations database target is required",
  );
  exactKeys(
    targetValue,
    TARGET_KEYS,
    "Conditions expectations database target has an open or incomplete shape",
  );
  if (targetValue.writesPerformed !== 0) {
    throw new Error("Conditions expectations database target is invalid");
  }
  const databaseTarget: NeonTargetReport = {
    projectId: requiredText(
      targetValue.projectId,
      "Conditions expectations project ID is required",
    ),
    branchId: requiredText(
      targetValue.branchId,
      "Conditions expectations branch ID is required",
    ),
    endpointId: requiredText(
      targetValue.endpointId,
      "Conditions expectations endpoint ID is required",
    ),
    hostnameSha256: requiredText(
      targetValue.hostnameSha256,
      "Conditions expectations hostname hash is required",
    ),
    migrationHead:
      targetValue.migrationHead === null
        ? null
        : requiredText(
            targetValue.migrationHead,
            "Conditions expectations migration head is invalid",
          ),
    ledgerPresent: targetValue.ledgerPresent === true,
    writesPerformed: 0,
  };
  if (
    !/^[a-f0-9]{64}$/.test(databaseTarget.hostnameSha256) ||
    !databaseTarget.ledgerPresent ||
    databaseTarget.migrationHead === null ||
    databaseTarget.writesPerformed !== 0
  ) {
    throw new Error("Conditions expectations database target is invalid");
  }

  return {
    contract: CONDITIONS_RELEASE_EXPECTATIONS_CONTRACT,
    releaseId,
    releaseManifestSha256,
    expectedCalculationCounts,
    databaseTarget,
  };
}

export function conditionsReleaseExpectationTargetsMatch(
  expected: NeonTargetReport,
  observed: NeonTargetReport,
): boolean {
  return JSON.stringify(expected) === JSON.stringify(observed);
}
