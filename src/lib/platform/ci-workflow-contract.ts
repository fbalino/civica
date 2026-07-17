import { createHash } from "node:crypto";

/**
 * PLT-001 — fail-closed platform contract for the canonical GitHub Actions workflow.
 *
 * The workflow is intentionally small and byte-canonical. Exact source
 * equality closes YAML indentation/comment/duplicate-key tricks, while the
 * semantic checks below document and independently verify the security and
 * command-order contract. No YAML/runtime dependency is needed by this gate.
 */

export const CANONICAL_CI_WORKFLOW = ".github/workflows/ci.yml";
export const RETIRED_CLAIMS_WORKFLOW = ".github/workflows/claims-docs.yml";

/** SHA-256 of the complete production build command before the CI refactor. */
export const BUILD_CORE_SHA256 =
  "22d2c55fe80883f12fb81a6d2938c22a0a76bae323e186243228be4c74f5e63a";

export const REQUIRED_CI_COMMANDS = [
  "npm ci",
  "npm run validate:ci-workflow",
  "node plan/tools/validate-master-plan.mjs",
  "npm run validate:secrets",
  "npm run validate:deps",
  "npm run validate:lint",
  "npm run typecheck",
  "npm run validate:module-coverage",
  "npm run build:ci",
  "npx playwright install --with-deps chromium",
  "npm run test:e2e -- e2e/harness.selftest.spec.ts e2e/ci-smoke.spec.ts --workers=1 --retries=0",
] as const;

const CANONICAL_LINES = [
  "name: Civica continuous integration",
  "",
  "on:",
  "  push:",
  "    branches:",
  "      - main",
  "  pull_request:",
  "",
  "permissions:",
  "  contents: read",
  "",
  "concurrency:",
  "  group: civica-ci-${{ github.workflow }}-${{ github.ref }}",
  "  cancel-in-progress: true",
  "",
  "jobs:",
  "  verify:",
  "    runs-on: ubuntu-latest",
  "    timeout-minutes: 60",
  "    steps:",
  "      - name: Check out repository",
  "        uses: actions/checkout@v6",
  "      - name: Use supported Node runtime",
  "        uses: actions/setup-node@v6",
  "        with:",
  "          node-version: 22",
  "          cache: npm",
  "      - name: Install locked dependencies",
  "        run: npm ci",
  "      - name: Validate canonical CI contract",
  "        run: npm run validate:ci-workflow",
  "      - name: Validate master plan",
  "        run: node plan/tools/validate-master-plan.mjs",
  "      - name: Scan repository for secrets",
  "        run: npm run validate:secrets",
  "      - name: Audit production dependencies",
  "        run: npm run validate:deps",
  "      - name: Lint owned source",
  "        run: npm run validate:lint",
  "      - name: Type-check",
  "        run: npm run typecheck",
  "      - name: Module coverage gates",
  "        run: npm run validate:module-coverage",
  "      - name: Credential-free production build",
  "        run: npm run build:ci",
  "      - name: Install Chromium",
  "        run: npx playwright install --with-deps chromium",
  "      - name: Production browser and API smoke",
  "        env:",
  "          E2E_WEBSERVER_CMD: npm run start",
  "        run: npm run test:e2e -- e2e/harness.selftest.spec.ts e2e/ci-smoke.spec.ts --workers=1 --retries=0",
] as const;

export const CANONICAL_CI_WORKFLOW_SOURCE = `${CANONICAL_LINES.join("\n")}\n`;

export type PackageScripts = Record<string, string | undefined>;
export type ClaimsGateScript = { npmScript: string };

/**
 * Extract only `run` scalars belonging to the two-space `jobs.verify` block.
 * Exact eight-space indentation is intentional: comments, names, env values,
 * and commands moved to another job cannot satisfy the listing.
 */
export function ciWorkflowCommandListing(source: string): string[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const verifyStart = lines.indexOf("  verify:");
  if (verifyStart < 0) return [];

  let verifyEnd = lines.length;
  for (let index = verifyStart + 1; index < lines.length; index += 1) {
    if (/^  [a-zA-Z0-9_-]+:\s*$/.test(lines[index])) {
      verifyEnd = index;
      break;
    }
  }

  return lines
    .slice(verifyStart + 1, verifyEnd)
    .filter((line) => line.startsWith("        run: "))
    .map((line) => line.slice("        run: ".length));
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/** Validate both the byte-canonical file and its independently stated rules. */
export function ciWorkflowErrors(source: string): string[] {
  const errors: string[] = [];
  const normalized = source.replace(/\r\n/g, "\n");

  if (normalized !== CANONICAL_CI_WORKFLOW_SOURCE) {
    errors.push("workflow bytes differ from the canonical fail-closed source");
  }

  if (
    !normalized.includes(
      "on:\n  push:\n    branches:\n      - main\n  pull_request:\n",
    )
  ) {
    errors.push(
      "triggers must be exactly push-to-main plus every pull request",
    );
  }
  if (normalized.includes("pull_request_target:")) {
    errors.push("pull_request_target is forbidden for fork-safe CI");
  }
  if (!normalized.includes("permissions:\n  contents: read\n")) {
    errors.push("least-privilege contents: read permission is missing");
  }
  if (!normalized.includes("  cancel-in-progress: true\n")) {
    errors.push("superseded CI runs must be cancelled");
  }
  if (!normalized.includes("    timeout-minutes: 60\n")) {
    errors.push("the canonical job timeout is missing or unbounded");
  }
  if (
    !normalized.includes("actions/checkout@v6") ||
    !normalized.includes("actions/setup-node@v6") ||
    !normalized.includes("          node-version: 22\n") ||
    !normalized.includes("          cache: npm\n")
  ) {
    errors.push("supported pinned actions/Node 22 npm-cache setup drifted");
  }

  const commands = ciWorkflowCommandListing(normalized);
  if (!arraysEqual(commands, REQUIRED_CI_COMMANDS)) {
    errors.push(
      `verify commands must match exactly in order; found ${JSON.stringify(commands)}`,
    );
  }
  if (new Set(commands).size !== commands.length) {
    errors.push("verify commands must not be duplicated");
  }
  if (/\|\|\s*true(?:\s|$)/m.test(normalized)) {
    errors.push("required commands may not be neutralized with || true");
  }
  if (/^\s*(?:-\s+)?continue-on-error\s*:/m.test(normalized)) {
    errors.push("continue-on-error is forbidden at every scope and value");
  }
  if (/^\s*(?:-\s+)?if\s*:/m.test(normalized)) {
    errors.push("conditional CI steps/jobs are forbidden");
  }
  if (/\bsecrets\s*(?:\.|\[)/i.test(normalized)) {
    errors.push("secrets.* references are forbidden; CI must be fork-safe");
  }
  if (/\bDATABASE_URL\b/.test(normalized)) {
    errors.push("DATABASE_URL is forbidden in the credential-free workflow");
  }
  if (/^    env:\s*$/m.test(normalized)) {
    errors.push("job-level env is forbidden");
  }
  if (
    !normalized.includes(
      "        env:\n          E2E_WEBSERVER_CMD: npm run start\n",
    )
  ) {
    errors.push("browser smoke must own the already-built production server");
  }

  return [...new Set(errors)];
}

/**
 * Prove the credential-free build is the same build body, and that its
 * transitive graph retains the claims/unit and Index change-control gates.
 */
export function ciScriptGraphErrors(scripts: PackageScripts): string[] {
  const errors: string[] = [];
  const exact: Record<string, string> = {
    "validate:ci-workflow": "tsx scripts/validate-ci-workflow.ts",
    prebuild:
      "npm run validate:env -- --context=build && npm run validate:build-prereqs",
    "prebuild:ci":
      "npm run validate:env -- --context=ci && npm run validate:build-prereqs",
    build: "npm run build:core",
    "build:ci": "npm run --ignore-scripts build",
    "validate:claims-docs": "tsx scripts/validate-claims-docs.ts",
    "validate:cache-consistency":
      "node --import tsx --test src/lib/platform/cache-consistency.test.ts src/lib/api/response-cache.test.ts src/lib/api/problem-response.test.ts scripts/validate-cache-consistency.test.ts && tsx scripts/validate-cache-consistency.ts",
    "validate:release-consistency":
      "node --import tsx --test src/lib/ci/release-publication.test.ts src/lib/exports/atlas-release.test.ts src/lib/pulse/v2/publication-consistency.test.ts scripts/validate-release-consistency.test.ts && tsx scripts/validate-release-consistency.ts && npm run validate:deployment-rehearsal",
    "validate:query-budgets":
      "node --import tsx --test src/lib/platform/query-budget.test.ts scripts/validate-query-budgets.test.ts && tsx scripts/validate-query-budgets.ts",
    "validate:route-performance-telemetry":
      "node --import tsx --test src/lib/platform/route-performance-telemetry.test.ts && tsx scripts/validate-route-performance-telemetry.ts && npm run validate:pipeline-observability && npm run validate:error-monitoring && npm run validate:health-status && npm run validate:ask-civica",
    "validate:error-monitoring":
      "node --import tsx --test src/lib/platform/error-monitoring.test.ts && tsx scripts/validate-error-monitoring.ts",
    "validate:build-prereqs":
      "npm run validate:constitution-search && npm run validate:pulse-incidents && npm run validate:pulse-classification-state && npm run validate:pulse-review-sla && npm run validate:pulse-information-environment && npm run validate:pulse-validation-protocol",
  };

  for (const [name, expected] of Object.entries(exact)) {
    if (scripts[name] !== expected) {
      errors.push(
        `package script ${name} drifted from ${JSON.stringify(expected)}`,
      );
    }
  }

  const buildCore = scripts["build:core"] ?? "";
  const buildCoreSha256 = createHash("sha256").update(buildCore).digest("hex");
  if (buildCoreSha256 !== BUILD_CORE_SHA256) {
    errors.push(
      `build:core command body drifted (expected ${BUILD_CORE_SHA256}, found ${buildCoreSha256})`,
    );
  }
  for (const required of [
    "npm run validate:index-change-control",
    "npm run validate:query-budgets",
    "npm run validate:route-performance-telemetry",
    "npm run validate:claims-docs",
    "next build",
  ]) {
    const occurrences = buildCore.split(required).length - 1;
    if (occurrences !== 1) {
      errors.push(`build:core must contain ${required} exactly once`);
    }
  }
  if (buildCore.includes(":live")) {
    errors.push("build:core must not invoke live/database-mutating validators");
  }
  if (/DATABASE_URL|\bsecrets\b/.test(scripts["build:ci"] ?? "")) {
    errors.push("build:ci must not depend on credentials");
  }

  return errors;
}

/** The claims aggregate is the deliberate transitive owner of `npm test`. */
export function ciTransitiveGateErrors(
  claimsChecks: readonly ClaimsGateScript[],
): string[] {
  const unitChecks = claimsChecks.filter((check) => check.npmScript === "test");
  return unitChecks.length === 1
    ? []
    : ["validate:claims-docs must contain the unit-test script exactly once"];
}
