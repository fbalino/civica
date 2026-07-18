import { createHash } from "node:crypto";

import { ROUTE_INVENTORY } from "@/lib/api/route-inventory/registry";
import {
  ATLAS_SURFACE_DATA_MATRIX,
  ATLAS_SURFACE_STATE_KEYS,
} from "@/lib/atlas/surface-data-matrix";
import {
  MANUAL_PRODUCTION_ADAPTERS,
  SCHEDULED_PRODUCTION_ADAPTERS,
} from "@/lib/data/production-adapter-registry";
import { DOMAIN_IDS } from "@/lib/provenance/domain-coverage";
import { GOLDEN_TESTS_REGISTRY } from "@/lib/qa/golden-tests-registry";

/** QA-001 — generated verification posture for every production surface. */
export const VERIFICATION_MATRIX_SCHEMA_VERSION =
  "civica-verification-matrix/v1" as const;

export const VERIFICATION_LAYERS = [
  "unit",
  "integration",
  "database",
  "browser",
  "manual",
] as const;
export type VerificationLayer = (typeof VERIFICATION_LAYERS)[number];

export const COVERAGE_STATUSES = [
  "covered",
  "partial",
  "planned",
  "not_applicable",
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export type VerificationSurfaceKind =
  | "route"
  | "pipeline"
  | "calculation"
  | "data_domain"
  | "failure_state";

export interface CoverageCell {
  status: CoverageStatus;
  evidence: readonly string[];
  gapTask: string | null;
}

export interface VerificationMatrixEntry {
  id: string;
  kind: VerificationSurfaceKind;
  title: string;
  source: string;
  critical: true;
  owner: string;
  fixture: string;
  command: string;
  coverage: Record<VerificationLayer, CoverageCell>;
}

export interface ProductionRouteSource {
  sourcePath: string;
  route: string;
  kind: "page" | "handler" | "error_boundary";
}

export interface VerificationMatrixInputs {
  productionRoutes: readonly ProductionRouteSource[];
  checklistTaskIds: readonly string[];
}

export interface VerificationMatrix {
  schemaVersion: typeof VERIFICATION_MATRIX_SCHEMA_VERSION;
  semanticHash: string;
  summary: Record<VerificationSurfaceKind, number>;
  entries: readonly VerificationMatrixEntry[];
}

const cell = (
  status: CoverageStatus,
  evidence: readonly string[],
  gapTask: string | null = null,
): CoverageCell => ({ status, evidence, gapTask });

const na = (): CoverageCell => cell("not_applicable", []);

const routeInventoryTest = "src/lib/api/route-inventory/__tests__/route-inventory.test.ts";
const routeIoTest = "npm run validate:route-io-policy";
const pipelineTest = "src/lib/platform/pipeline-observability.test.ts";
const atlasMatrixTest = "npm run validate:atlas-surface-data-matrix";

function coverage(
  values: Partial<Record<VerificationLayer, CoverageCell>>,
): Record<VerificationLayer, CoverageCell> {
  return {
    unit: values.unit ?? na(),
    integration: values.integration ?? na(),
    database: values.database ?? na(),
    browser: values.browser ?? na(),
    manual: values.manual ?? na(),
  };
}

function routeEntry(route: ProductionRouteSource): VerificationMatrixEntry {
  if (route.kind === "handler") {
    const inventory = ROUTE_INVENTORY.find(
      ({ filePath }) => `src/app/${filePath}` === route.sourcePath,
    );
    const owner = inventory?.exposure === "cron"
      ? "Scheduled data operations"
      : inventory?.exposure === "admin" || inventory?.exposure === "pulse-coding"
        ? "Admin and reviewer operations"
        : "Public API and platform";
    return {
      id: `route:${route.sourcePath}`,
      kind: "route",
      title: `${route.route} API handler`,
      source: route.sourcePath,
      critical: true,
      owner,
      fixture: inventory
        ? `${inventory.exposure} route-inventory declaration for ${inventory.methods.join(", ")}`
        : "Unregistered handler (must fail validation)",
      command: "npm run validate:route-inventory && npm run validate:route-io-policy",
      coverage: coverage({
        unit: cell("covered", [routeInventoryTest]),
        integration: cell("covered", [routeIoTest]),
        database: cell("planned", ["Deterministic legally shareable database fixture"], "QA-003"),
        browser: na(),
        manual:
          inventory?.exposure === "admin" ||
          inventory?.exposure === "cron" ||
          inventory?.exposure === "pulse-coding"
            ? cell("planned", ["Isolated operator journey"], "QA-011")
            : na(),
      }),
    };
  }

  if (route.kind === "error_boundary") {
    return {
      id: `route:${route.sourcePath}`,
      kind: "route",
      title: `${route.route} error boundary`,
      source: route.sourcePath,
      critical: true,
      owner: "Reader reliability and platform",
      fixture: "src/app/error-boundary.test.ts",
      command: "node --import tsx --test src/app/error-boundary.test.ts",
      coverage: coverage({
        unit: cell("covered", ["src/app/error-boundary.test.ts"]),
        integration: cell("covered", ["src/app/error-boundary.test.ts"]),
        database: na(),
        browser: cell("planned", ["Tokenized error-boundary browser fixtures"], "QA-013"),
        manual: na(),
      }),
    };
  }

  const atlasSurface = ATLAS_SURFACE_DATA_MATRIX.rows.find(
    ({ renderer }) => renderer === route.sourcePath,
  );
  return {
    id: `route:${route.sourcePath}`,
    kind: "route",
    title: `${route.route} reader page`,
    source: route.sourcePath,
    critical: true,
    owner: route.sourcePath.includes("/admin/")
      ? "Admin and reviewer operations"
      : "Reader experience and Atlas product",
    fixture: atlasSurface
      ? `${atlasSurface.id} surface-data row`
      : "Route-specific browser fixture required",
    command: "npm run test:e2e",
    coverage: coverage({
      unit: atlasSurface?.tests.length
        ? cell("covered", atlasSurface.tests)
        : cell("partial", ["Route/module registry"], "QA-013"),
      integration: atlasSurface?.tests.length
        ? cell("covered", [atlasMatrixTest])
        : cell("partial", ["Route/module registry"], "QA-013"),
      database: cell("planned", ["Deterministic legally shareable database fixture"], "QA-003"),
      browser: cell("partial", ["Canonical browser harness"], "QA-013"),
      manual: route.sourcePath.includes("/admin/")
        ? cell("planned", ["Isolated admin/reviewer journey"], "QA-011")
        : na(),
    }),
  };
}

function pipelineEntries(): VerificationMatrixEntry[] {
  return [
    ...SCHEDULED_PRODUCTION_ADAPTERS.map((pipeline) => ({
      pipeline,
      trigger: "scheduled" as const,
    })),
    ...MANUAL_PRODUCTION_ADAPTERS.map((pipeline) => ({
      pipeline,
      trigger: "manual" as const,
    })),
  ].map(({ pipeline, trigger }) => ({
    id: `pipeline:${pipeline.id}`,
    kind: "pipeline" as const,
    title: `${pipeline.id} ${trigger} production pipeline`,
    source: pipeline.implementationPaths.join(", "),
    critical: true as const,
    owner: trigger === "scheduled" ? "Scheduled data operations" : "Data ingestion and release operations",
    fixture: trigger === "scheduled"
      ? `Registered ${pipeline.id} cron adapter and source-input specification`
      : `Registered ${pipeline.id} manual adapter and canonical command`,
    command: trigger === "scheduled"
      ? "npm run validate:pipeline-observability && npm run validate:production-adapters"
      : `npm run ${pipeline.canonicalNpmScript}`,
    coverage: coverage({
      unit: cell("covered", [pipelineTest]),
      integration: cell("covered", ["npm run validate:pipeline-observability", "npm run validate:production-adapters"]),
      database: cell("planned", ["Deterministic legally shareable pipeline fixture"], "QA-003"),
      browser: na(),
      manual: cell("planned", ["Scheduled-data failure recovery journey"], "QA-011"),
    }),
  }));
}

function calculationEntries(): VerificationMatrixEntry[] {
  return GOLDEN_TESTS_REGISTRY.map((calculation) => ({
    id: `calculation:${calculation.subtopic}`,
    kind: "calculation" as const,
    title: calculation.title,
    source: calculation.sourceOfTruth.join(", "),
    critical: true as const,
    owner: "Research-methods and data integrity",
    fixture: calculation.testFiles.join(", "),
    command: "npm run validate:golden-tests",
    coverage: coverage({
      unit: cell("covered", calculation.testFiles),
      integration: cell("covered", ["npm run validate:golden-tests"]),
      database: na(),
      browser: na(),
      manual: cell("planned", ["Statistical reproducibility review"], "QA-008"),
    }),
  }));
}

function dataDomainEntries(): VerificationMatrixEntry[] {
  return DOMAIN_IDS.map((domain) => ({
    id: `data-domain:${domain}`,
    kind: "data_domain" as const,
    title: `${domain} source-coverage domain`,
    source: "src/lib/provenance/domain-coverage.ts",
    critical: true as const,
    owner: "Atlas data provenance",
    fixture: `domain-coverage generated fixture for ${domain}`,
    command: "npm run validate:source-coverage",
    coverage: coverage({
      unit: cell("covered", ["src/lib/provenance/domain-coverage.test.ts"]),
      integration: cell("covered", ["npm run validate:source-coverage"]),
      database: cell("planned", ["Deterministic legally shareable domain fixture"], "QA-003"),
      browser: cell("partial", ["Source-coverage reader surface"], "QA-013"),
      manual: cell("planned", ["Publisher-evidence value-fidelity audit"], "DAT-034"),
    }),
  }));
}

const REQUEST_FAILURE_STATES = [
  {
    id: "request.not_found",
    title: "Absent entity returns the branded not-found response",
    source: "src/app/not-found.tsx",
    fixture: "src/app/error-boundary.test.ts",
    command: "node --import tsx --test src/app/error-boundary.test.ts",
  },
  {
    id: "request.service_failure",
    title: "Service or database failure returns a noindex retry response",
    source: "src/app/error.tsx, src/app/global-error.tsx",
    fixture: "src/app/error-boundary.test.ts",
    command: "node --import tsx --test src/app/error-boundary.test.ts",
  },
  {
    id: "request.validation",
    title: "Invalid request input fails at the fixed safe boundary",
    source: "src/lib/api/route-io-policy/registry.ts",
    fixture: "src/lib/api/request-contract.test.ts",
    command: "npm run validate:route-io-policy",
  },
  {
    id: "request.authorization",
    title: "Unauthorized mutation and scheduled requests fail closed",
    source: "src/lib/api/route-inventory/registry.ts",
    fixture: "src/lib/api/cron-job.test.ts",
    command: "npm run validate:route-inventory && npm run validate:cron-safety",
  },
  {
    id: "request.rate_limit",
    title: "Rate-limited public work avoids the protected downstream operation",
    source: "src/lib/api/rate-limit-policy.ts",
    fixture: "src/lib/api/rate-limit-policy.test.ts",
    command: "npm run validate:rate-limit-policy",
  },
] as const;

const PIPELINE_FAILURE_STATES = ["missed", "failed", "empty", "anomalous"] as const;

function failureStateEntries(): VerificationMatrixEntry[] {
  const atlasStates = ATLAS_SURFACE_STATE_KEYS.map((state) => ({
    id: `failure:atlas.${state}`,
    kind: "failure_state" as const,
    title: `Atlas ${state} state`,
    source: "src/lib/atlas/surface-data-matrix.ts",
    critical: true as const,
    owner: "Atlas reference product",
    fixture: "atlas surface-data matrix state declaration",
    command: atlasMatrixTest,
    coverage: coverage({
      unit: cell("covered", ["src/lib/atlas/surface-data-matrix.test.ts"]),
      integration: cell("covered", [atlasMatrixTest]),
      database: cell("planned", ["Deterministic state fixture"], "QA-003"),
      browser: cell("planned", ["Representative state browser fixture"], "ATL-018"),
      manual: na(),
    }),
  }));
  const pipelineStates = PIPELINE_FAILURE_STATES.map((state) => ({
    id: `failure:pipeline.${state}`,
    kind: "failure_state" as const,
    title: `Pipeline ${state} alert state`,
    source: "src/lib/platform/pipeline-observability.ts",
    critical: true as const,
    owner: "Scheduled data operations",
    fixture: "src/lib/platform/pipeline-observability.test.ts",
    command: "npm run validate:pipeline-observability",
    coverage: coverage({
      unit: cell("covered", [pipelineTest]),
      integration: cell("covered", ["npm run validate:pipeline-observability"]),
      database: cell("planned", ["Deterministic pipeline-alert fixture"], "QA-003"),
      browser: na(),
      manual: cell("covered", ["data/OPERATIONAL-RUNBOOKS.md"]),
    }),
  }));
  const requestStates = REQUEST_FAILURE_STATES.map((state) => ({
    id: `failure:${state.id}`,
    kind: "failure_state" as const,
    title: state.title,
    source: state.source,
    critical: true as const,
    owner: "Platform reliability and API safety",
    fixture: state.fixture,
    command: state.command,
    coverage: coverage({
      unit: cell("covered", [state.fixture]),
      integration: cell("covered", [state.command]),
      database: na(),
      browser: state.id === "request.not_found" || state.id === "request.service_failure"
        ? cell("planned", ["Error-route browser fixture"], "QA-013")
        : na(),
      manual: na(),
    }),
  }));
  return [...atlasStates, ...pipelineStates, ...requestStates];
}

function summary(entries: readonly VerificationMatrixEntry[]) {
  const result: Record<VerificationSurfaceKind, number> = {
    route: 0,
    pipeline: 0,
    calculation: 0,
    data_domain: 0,
    failure_state: 0,
  };
  for (const entry of entries) result[entry.kind] += 1;
  return result;
}

function semanticHash(entries: readonly VerificationMatrixEntry[]) {
  return createHash("sha256")
    .update(JSON.stringify({ schemaVersion: VERIFICATION_MATRIX_SCHEMA_VERSION, entries }))
    .digest("hex");
}

/** Builds the deterministic checked artifact; filesystem discovery stays in scripts/. */
export function buildVerificationMatrix(
  input: VerificationMatrixInputs,
): VerificationMatrix {
  const entries = [
    ...input.productionRoutes.map(routeEntry),
    ...pipelineEntries(),
    ...calculationEntries(),
    ...dataDomainEntries(),
    ...failureStateEntries(),
  ].sort((left, right) => left.id.localeCompare(right.id));
  return {
    schemaVersion: VERIFICATION_MATRIX_SCHEMA_VERSION,
    semanticHash: semanticHash(entries),
    summary: summary(entries),
    entries,
  };
}

export function renderVerificationMatrix(input: VerificationMatrixInputs) {
  return `${JSON.stringify(buildVerificationMatrix(input), null, 2)}\n`;
}

function expectedIds(input: VerificationMatrixInputs): string[] {
  return [
    ...input.productionRoutes.map(({ sourcePath }) => `route:${sourcePath}`),
    ...SCHEDULED_PRODUCTION_ADAPTERS.map(({ id }) => `pipeline:${id}`),
    ...MANUAL_PRODUCTION_ADAPTERS.map(({ id }) => `pipeline:${id}`),
    ...GOLDEN_TESTS_REGISTRY.map(({ subtopic }) => `calculation:${subtopic}`),
    ...DOMAIN_IDS.map((id) => `data-domain:${id}`),
    ...ATLAS_SURFACE_STATE_KEYS.map((id) => `failure:atlas.${id}`),
    ...PIPELINE_FAILURE_STATES.map((id) => `failure:pipeline.${id}`),
    ...REQUEST_FAILURE_STATES.map(({ id }) => `failure:${id}`),
  ].sort();
}

/** Validates completeness, exact source registration, and every declared gap task. */
export function verificationMatrixErrors(
  matrix: VerificationMatrix,
  input: VerificationMatrixInputs,
): string[] {
  const errors: string[] = [];
  if (matrix.schemaVersion !== VERIFICATION_MATRIX_SCHEMA_VERSION) {
    errors.push("schema version drifted");
  }
  const ids = matrix.entries.map(({ id }) => id).sort();
  if (new Set(ids).size !== ids.length) errors.push("matrix contains duplicate entry ids");
  const expected = expectedIds(input);
  for (const id of expected) if (!ids.includes(id)) errors.push(`unregistered critical surface: ${id}`);
  for (const id of ids) if (!expected.includes(id)) errors.push(`stale matrix surface: ${id}`);
  for (const route of input.productionRoutes.filter(({ kind }) => kind === "handler")) {
    if (!ROUTE_INVENTORY.some(({ filePath }) => `src/app/${filePath}` === route.sourcePath)) {
      errors.push(`unregistered API handler: ${route.sourcePath}`);
    }
  }
  if (matrix.semanticHash !== semanticHash(matrix.entries)) {
    errors.push("semantic hash does not match matrix entries");
  }
  const expectedSummary = summary(matrix.entries);
  for (const kind of Object.keys(expectedSummary) as VerificationSurfaceKind[]) {
    if (matrix.summary[kind] !== expectedSummary[kind]) {
      errors.push(`summary drift for ${kind}`);
    }
  }
  const checklistTaskIds = new Set(input.checklistTaskIds);
  for (const entry of matrix.entries) {
    for (const field of ["title", "source", "owner", "fixture", "command"] as const) {
      if (!entry[field].trim()) errors.push(`${entry.id}: ${field} is blank`);
    }
    for (const layer of VERIFICATION_LAYERS) {
      const current = entry.coverage[layer];
      if (!COVERAGE_STATUSES.includes(current.status)) {
        errors.push(`${entry.id}.${layer}: unknown coverage status`);
      }
      if (current.status === "covered" && current.evidence.length === 0) {
        errors.push(`${entry.id}.${layer}: covered status needs evidence`);
      }
      if (
        (current.status === "partial" || current.status === "planned") &&
        !current.gapTask
      ) {
        errors.push(`${entry.id}.${layer}: incomplete status needs a gap task`);
      }
      if (
        (current.status === "covered" || current.status === "not_applicable") &&
        current.gapTask
      ) {
        errors.push(`${entry.id}.${layer}: complete or n/a status cannot carry a gap task`);
      }
      if (current.gapTask && !checklistTaskIds.has(current.gapTask)) {
        errors.push(`${entry.id}.${layer}: unknown gap task ${current.gapTask}`);
      }
    }
  }
  return errors;
}
