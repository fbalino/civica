/**
 * PLT-010 credential-free cron closure gate.
 *
 * Cross-checks the deployment schedule, production-adapter registry, runtime
 * cron registry, and every route source without opening a database or making a
 * network request.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

import vercelConfig from "../vercel.json";
import {
  CRON_JOB_DEFINITIONS,
  CRON_JOB_LEASE_MS,
} from "../src/lib/api/cron-job-registry";
import { latestCronScheduleSlot } from "../src/lib/api/cron-schedule";
import { SCHEDULED_PRODUCTION_ADAPTERS } from "../src/lib/data/production-adapter-registry";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src/app");
const CRON_DIR = path.join(APP_DIR, "api/cron");
const EXPECTED_SCHEDULED_COUNT = 39;
const EXPECTED_RETIRED = [
  { id: "pulse.v1.ingest", route: "/api/cron/pulse/ingest" },
  { id: "pulse.v1.classify", route: "/api/cron/pulse/classify" },
  { id: "pulse.v1.calculate", route: "/api/cron/pulse/calculate" },
] as const;
// PLT-010 freezes the common lease at 30 minutes. A deliberate future
// increase must update this contract and its operational evidence together.
const EXPECTED_LEASE_MS = 30 * 60 * 1_000;
const MINIMUM_LEASE_MARGIN_MS = 10 * 60 * 1_000;
const SCHEDULE_VALIDATION_REFERENCE = new Date("2027-01-01T00:00:00.000Z");

/**
 * Current Vercel Node-function platform maximum/default fallback, checked
 * 2026-07-14. Routes with no explicit segment declaration are evaluated at
 * this conservative ceiling rather than assumed to run indefinitely.
 */
const VERCEL_UNDECLARED_MAX_DURATION_FALLBACK_SECONDS = 800;

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];
const HTTP_METHOD_SET = new Set<string>(HTTP_METHODS);

interface Problem {
  id: string;
  detail: string;
}

interface WrapperAssignment {
  variable: string;
  jobId: string;
}

export interface RouteSourceFacts {
  hasSanctionedWrapperImport: boolean;
  hasDirectCronAuthIdentifier: boolean;
  wrapperCallCount: number;
  wrapperAssignments: WrapperAssignment[];
  aliases: Map<HttpMethod, string[]>;
  directMethods: HttpMethod[];
  maxDuration: number | null | "invalid";
  runtime: string | null | "invalid";
  dynamic: string | null | "invalid";
}

async function findRouteFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await findRouteFiles(absolute)));
    else if (entry.isFile() && entry.name === "route.ts") files.push(absolute);
  }
  return files.sort();
}

function routeFromFile(absolutePath: string): string {
  const appRelative = path
    .relative(APP_DIR, absolutePath)
    .split(path.sep)
    .join("/");
  return `/${appRelative.replace(/\/route\.ts$/, "")}`;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

function isExported(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    Boolean(
      ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
    )
  );
}

function asHttpMethod(value: string): HttpMethod | null {
  return HTTP_METHOD_SET.has(value) ? (value as HttpMethod) : null;
}

export function inspectRouteSource(
  fileName: string,
  source: string,
): RouteSourceFacts {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let hasSanctionedWrapperImport = false;
  let hasDirectCronAuthIdentifier = false;
  let wrapperCallCount = 0;
  const wrapperAssignments: WrapperAssignment[] = [];
  const aliases = new Map<HttpMethod, string[]>();
  const directMethods = new Set<HttpMethod>();
  let sawMaxDuration = false;
  const literalMaxDurations: number[] = [];
  let sawRuntime = false;
  const literalRuntimes: string[] = [];
  let sawDynamic = false;
  const literalDynamics: string[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "@/lib/api/cron-job" &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      hasSanctionedWrapperImport =
        statement.importClause.namedBindings.elements.some(
          (element) =>
            (element.propertyName?.text ?? element.name.text) ===
              "withCronJob" && element.name.text === "withCronJob",
        );
    }

    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const method = asHttpMethod(element.name.text);
        if (!method) continue;
        const values = aliases.get(method) ?? [];
        values.push(element.propertyName?.text ?? element.name.text);
        aliases.set(method, values);
      }
    }

    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      isExported(statement)
    ) {
      const method = asHttpMethod(statement.name.text);
      if (method) directMethods.add(method);
    }

    if (ts.isVariableStatement(statement) && isExported(statement)) {
      const isConst = Boolean(
        statement.declarationList.flags & ts.NodeFlags.Const,
      );
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const method = asHttpMethod(declaration.name.text);
        if (method) directMethods.add(method);
        if (declaration.name.text === "runtime") {
          sawRuntime = true;
          if (
            isConst &&
            declaration.initializer &&
            ts.isStringLiteral(declaration.initializer)
          ) {
            literalRuntimes.push(declaration.initializer.text);
          }
        }
        if (declaration.name.text === "dynamic") {
          sawDynamic = true;
          if (
            isConst &&
            declaration.initializer &&
            ts.isStringLiteral(declaration.initializer)
          ) {
            literalDynamics.push(declaration.initializer.text);
          }
        }
        if (declaration.name.text !== "maxDuration") continue;
        sawMaxDuration = true;
        if (
          isConst &&
          declaration.initializer &&
          ts.isNumericLiteral(declaration.initializer)
        ) {
          literalMaxDurations.push(Number(declaration.initializer.text));
        }
      }
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node) && node.text === "requireCronAuth") {
      hasDirectCronAuthIdentifier = true;
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "withCronJob"
    ) {
      wrapperCallCount++;
      const declaration = node.parent;
      const declarationList = ts.isVariableDeclaration(declaration)
        ? declaration.parent
        : null;
      const jobId = node.arguments[0];
      if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer === node &&
        ts.isIdentifier(declaration.name) &&
        declarationList &&
        ts.isVariableDeclarationList(declarationList) &&
        Boolean(declarationList.flags & ts.NodeFlags.Const) &&
        jobId &&
        ts.isStringLiteral(jobId)
      ) {
        wrapperAssignments.push({
          variable: declaration.name.text,
          jobId: jobId.text,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const maxDuration = !sawMaxDuration
    ? null
    : literalMaxDurations.length === 1
      ? literalMaxDurations[0]
      : "invalid";
  const runtime = !sawRuntime
    ? null
    : literalRuntimes.length === 1
      ? literalRuntimes[0]
      : "invalid";
  const dynamic = !sawDynamic
    ? null
    : literalDynamics.length === 1
      ? literalDynamics[0]
      : "invalid";
  return {
    hasSanctionedWrapperImport,
    hasDirectCronAuthIdentifier,
    wrapperCallCount,
    wrapperAssignments,
    aliases,
    directMethods: [...directMethods].sort(),
    maxDuration,
    runtime,
    dynamic,
  };
}

function pushDuplicates(
  problems: Problem[],
  id: string,
  label: string,
  values: readonly string[],
): void {
  for (const value of duplicates(values)) {
    problems.push({ id, detail: `duplicate ${label}: ${value}` });
  }
}

async function main(): Promise<void> {
  const problems: Problem[] = [];
  const scheduledManifest = vercelConfig.crons;
  const scheduledDefinitions = CRON_JOB_DEFINITIONS.filter(
    (definition) => !definition.retired,
  );
  const retiredDefinitions = CRON_JOB_DEFINITIONS.filter(
    (definition) => definition.retired,
  );

  if (scheduledManifest.length !== EXPECTED_SCHEDULED_COUNT) {
    problems.push({
      id: "scheduled-count",
      detail: `vercel.json has ${scheduledManifest.length}; expected ${EXPECTED_SCHEDULED_COUNT}`,
    });
  }
  if (SCHEDULED_PRODUCTION_ADAPTERS.length !== EXPECTED_SCHEDULED_COUNT) {
    problems.push({
      id: "adapter-count",
      detail: `production adapter registry has ${SCHEDULED_PRODUCTION_ADAPTERS.length}; expected ${EXPECTED_SCHEDULED_COUNT}`,
    });
  }
  if (scheduledDefinitions.length !== EXPECTED_SCHEDULED_COUNT) {
    problems.push({
      id: "scheduled-definition-count",
      detail: `cron registry has ${scheduledDefinitions.length} scheduled definitions; expected ${EXPECTED_SCHEDULED_COUNT}`,
    });
  }
  if (retiredDefinitions.length !== EXPECTED_RETIRED.length) {
    problems.push({
      id: "retired-definition-count",
      detail: `cron registry has ${retiredDefinitions.length} retired definitions; expected ${EXPECTED_RETIRED.length}`,
    });
  }
  if (CRON_JOB_LEASE_MS !== EXPECTED_LEASE_MS) {
    problems.push({
      id: "lease-duration",
      detail: `common lease is ${CRON_JOB_LEASE_MS}ms; expected ${EXPECTED_LEASE_MS}ms (30 minutes)`,
    });
  }
  if (
    VERCEL_UNDECLARED_MAX_DURATION_FALLBACK_SECONDS * 1_000 +
      MINIMUM_LEASE_MARGIN_MS >
    CRON_JOB_LEASE_MS
  ) {
    problems.push({
      id: "platform-duration-fallback",
      detail: `Vercel fallback ${VERCEL_UNDECLARED_MAX_DURATION_FALLBACK_SECONDS}s plus the 10-minute safety margin must fit within lease ${CRON_JOB_LEASE_MS / 1_000}s`,
    });
  }

  pushDuplicates(
    problems,
    "duplicate-vercel-route",
    "Vercel route",
    scheduledManifest.map(({ path: route }) => route),
  );
  pushDuplicates(
    problems,
    "duplicate-adapter-route",
    "adapter route",
    SCHEDULED_PRODUCTION_ADAPTERS.map(({ route }) => route),
  );
  pushDuplicates(
    problems,
    "duplicate-adapter-id",
    "adapter id",
    SCHEDULED_PRODUCTION_ADAPTERS.map(({ id }) => id),
  );
  pushDuplicates(
    problems,
    "duplicate-definition-route",
    "cron definition route",
    CRON_JOB_DEFINITIONS.map(({ route }) => route),
  );
  pushDuplicates(
    problems,
    "duplicate-definition-id",
    "cron definition id",
    CRON_JOB_DEFINITIONS.map(({ id }) => id),
  );

  const manifestByRoute = new Map(
    scheduledManifest.map((entry) => [entry.path, entry]),
  );
  const adapterByRoute = new Map(
    SCHEDULED_PRODUCTION_ADAPTERS.map((entry) => [entry.route, entry]),
  );
  const definitionByRoute = new Map(
    CRON_JOB_DEFINITIONS.map((entry) => [entry.route, entry]),
  );

  for (const manifest of scheduledManifest) {
    try {
      latestCronScheduleSlot(manifest.schedule, SCHEDULE_VALIDATION_REFERENCE);
    } catch (error) {
      problems.push({
        id: "invalid-vercel-schedule",
        detail: `${manifest.path}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    const adapter = adapterByRoute.get(manifest.path);
    const definition = definitionByRoute.get(manifest.path);
    if (!adapter) {
      problems.push({
        id: "unregistered-vercel-route",
        detail: manifest.path,
      });
    }
    if (!definition || definition.retired) {
      problems.push({
        id: "missing-scheduled-definition",
        detail: manifest.path,
      });
      continue;
    }
    if (definition.schedule !== manifest.schedule) {
      problems.push({
        id: "schedule-drift",
        detail: `${manifest.path}: registry=${definition.schedule ?? "null"}, vercel=${manifest.schedule}`,
      });
    }
    if (adapter && definition.id !== adapter.id) {
      problems.push({
        id: "scheduled-id-drift",
        detail: `${manifest.path}: cron=${definition.id}, adapter=${adapter.id}`,
      });
    }
  }

  for (const adapter of SCHEDULED_PRODUCTION_ADAPTERS) {
    if (!manifestByRoute.has(adapter.route)) {
      problems.push({ id: "unscheduled-adapter", detail: adapter.route });
    }
    const definition = definitionByRoute.get(adapter.route);
    if (!definition || definition.retired || definition.id !== adapter.id) {
      problems.push({
        id: "adapter-definition-drift",
        detail: `${adapter.id} at ${adapter.route}`,
      });
    }
  }

  const expectedRetiredByRoute = new Map<string, string>(
    EXPECTED_RETIRED.map((entry) => [entry.route, entry.id]),
  );
  for (const definition of retiredDefinitions) {
    if (expectedRetiredByRoute.get(definition.route) !== definition.id) {
      problems.push({
        id: "unexpected-retired-job",
        detail: `${definition.id} at ${definition.route}`,
      });
    }
    if (definition.schedule !== null || manifestByRoute.has(definition.route)) {
      problems.push({
        id: "retired-job-scheduled",
        detail: `${definition.id} at ${definition.route}`,
      });
    }
  }
  for (const expected of EXPECTED_RETIRED) {
    const definition = definitionByRoute.get(expected.route);
    if (!definition || !definition.retired || definition.id !== expected.id) {
      problems.push({
        id: "missing-retired-job",
        detail: `${expected.id} at ${expected.route}`,
      });
    }
  }

  const routeFiles = await findRouteFiles(CRON_DIR);
  const diskRoutes = routeFiles.map(routeFromFile);
  if (
    routeFiles.length !==
    EXPECTED_SCHEDULED_COUNT + EXPECTED_RETIRED.length
  ) {
    problems.push({
      id: "route-file-count",
      detail: `found ${routeFiles.length}; expected ${EXPECTED_SCHEDULED_COUNT + EXPECTED_RETIRED.length}`,
    });
  }
  for (const route of diskRoutes) {
    if (!definitionByRoute.has(route)) {
      problems.push({ id: "unregistered-cron-route", detail: route });
    }
  }
  for (const definition of CRON_JOB_DEFINITIONS) {
    if (!diskRoutes.includes(definition.route)) {
      problems.push({
        id: "missing-cron-route-file",
        detail: `${definition.id} at ${definition.route}`,
      });
    }
  }

  let implicitDurationCount = 0;
  for (const [index, absolutePath] of routeFiles.entries()) {
    const route = diskRoutes[index];
    const definition = definitionByRoute.get(route);
    const source = await fs.readFile(absolutePath, "utf8");
    const relativePath = path.relative(ROOT, absolutePath);
    const facts = inspectRouteSource(relativePath, source);

    if (!facts.hasSanctionedWrapperImport) {
      problems.push({
        id: "missing-cron-wrapper-import",
        detail: relativePath,
      });
    }
    if (facts.hasDirectCronAuthIdentifier) {
      problems.push({
        id: "direct-cron-auth-remnant",
        detail: relativePath,
      });
    }
    if (facts.runtime !== "nodejs") {
      problems.push({
        id: "cron-runtime-drift",
        detail: `${relativePath}: runtime=${facts.runtime ?? "missing"}, expected=nodejs`,
      });
    }
    if (facts.dynamic !== "force-dynamic") {
      problems.push({
        id: "cron-dynamic-drift",
        detail: `${relativePath}: dynamic=${facts.dynamic ?? "missing"}, expected=force-dynamic`,
      });
    }

    if (facts.wrapperCallCount !== 1 || facts.wrapperAssignments.length !== 1) {
      problems.push({
        id: "cron-wrapper-count",
        detail: `${relativePath}: calls=${facts.wrapperCallCount}, literal const assignments=${facts.wrapperAssignments.length}`,
      });
    }
    const assignment = facts.wrapperAssignments[0];
    if (definition && assignment?.jobId !== definition.id) {
      problems.push({
        id: "cron-wrapper-id-drift",
        detail: `${relativePath}: wrapper=${assignment?.jobId ?? "missing"}, expected=${definition.id}`,
      });
    }

    const exportedMethods = new Set([
      ...facts.aliases.keys(),
      ...facts.directMethods,
    ]);
    const sortedMethods = HTTP_METHODS.filter((method) =>
      exportedMethods.has(method),
    );
    if (sortedMethods.join(",") !== "GET,POST") {
      problems.push({
        id: "cron-export-methods",
        detail: `${relativePath}: exports [${sortedMethods.join(", ")}], expected [GET, POST]`,
      });
    }
    for (const method of ["GET", "POST"] as const) {
      const values = facts.aliases.get(method) ?? [];
      if (
        facts.directMethods.includes(method) ||
        values.length !== 1 ||
        !assignment ||
        values[0] !== assignment.variable
      ) {
        problems.push({
          id: "unwrapped-cron-export",
          detail: `${relativePath}#${method}: expected ${assignment?.variable ?? "withCronJob result"}, found ${values.join(", ") || "direct/missing"}`,
        });
      }
    }

    const declared = facts.maxDuration;
    if (declared === "invalid") {
      problems.push({
        id: "invalid-max-duration",
        detail: `${relativePath}: maxDuration must be one positive integer literal`,
      });
      continue;
    }
    if (declared === null) implicitDurationCount++;
    const seconds = declared ?? VERCEL_UNDECLARED_MAX_DURATION_FALLBACK_SECONDS;
    if (!Number.isInteger(seconds) || seconds <= 0) {
      problems.push({
        id: "invalid-max-duration",
        detail: `${relativePath}: ${seconds}s`,
      });
    } else if (seconds * 1_000 >= CRON_JOB_LEASE_MS) {
      problems.push({
        id: "max-duration-exceeds-lease",
        detail: `${relativePath}: ${seconds}s must be below ${CRON_JOB_LEASE_MS / 1_000}s`,
      });
    } else if (seconds * 1_000 + MINIMUM_LEASE_MARGIN_MS > CRON_JOB_LEASE_MS) {
      problems.push({
        id: "insufficient-lease-margin",
        detail: `${relativePath}: ${seconds}s leaves less than the required 10-minute lease margin`,
      });
    }
  }

  console.log("=== Civica cron safety validation (PLT-010) ===\n");
  console.log(`Scheduled routes: ${scheduledDefinitions.length}`);
  console.log(`Explicitly retired routes: ${retiredDefinitions.length}`);
  console.log(`Cron route files: ${routeFiles.length}`);
  console.log(`Common lease: ${CRON_JOB_LEASE_MS / 60_000} minutes`);
  console.log(
    `Routes using conservative Vercel duration fallback: ${implicitDurationCount}`,
  );

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`- ${problem.id}: ${problem.detail}`);
    }
    console.error(`\nFAILED — ${problems.length} cron safety problem(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(
    "\nPASS — deployed cron routes are closed over registry, wrappers, exports, and lease timing.",
  );
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
