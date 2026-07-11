/**
 * validate-api-docs — CLM-012 public API contract validator.
 *
 *   Run with:  npm run validate:api-docs
 *              npm run validate:api-docs -- --help
 *
 * Deterministic, DB-free, network-free. Checks, in order (every check
 * runs regardless of earlier failures so one pass reports everything):
 *
 *   1. Route<->contract inventory — every `route.ts` under
 *      `src/app/api/v1/**` plus the bulk export route either has a
 *      matching `contract/registry.ts` entry (no "phantom route") and
 *      every registry entry's `filePath` exists on disk (no
 *      "uncontracted route" / stale entry).
 *   2. Docs coverage — every registry entry's `docSectionId` is
 *      rendered by `src/app/api-docs/page.tsx` (an `id="<id>"` section
 *      AND a `routeId="<id>"` EndpointSection call), so a live public
 *      route can never go undocumented without a build failure.
 *   3. Param drift — the query/path params `contract/registry.ts`
 *      declares for a route are cross-checked against a static scan of
 *      that route's `searchParams.get(All)(...)` calls and its
 *      `params: Promise<{...}>` path-param destructuring.
 *   4. Deprecation consistency — every registry entry with a
 *      `deprecation` contract has a route.ts that actually imports
 *      `withStructuralFamilyDeprecation`; every entry WITHOUT one
 *      does not.
 *   5. Generated example validity — `contract/examples.ts`'s EXAMPLES
 *      map covers every registry `exampleId`, and importing it (which
 *      strict-parses every example against its schema at module load)
 *      does not throw.
 *   6. CSV header contract — the export route's source no longer
 *      hand-types the CSV header/citation strings inline; it calls
 *      into `contract/csv.ts`.
 *
 * The comparison logic in each check is a pure function taking plain
 * strings/sets/arrays — no filesystem or DB access — so
 * `src/lib/api/contract/__tests__/validate-api-docs.test.ts` can drive
 * every failure mode with synthetic fixtures under `npm test`,
 * independent of this script's I/O layer.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  API_ROUTES,
  type RouteContract,
} from "../src/lib/api/contract/registry";

const ROOT = process.cwd();
const V1_DIR = path.join(ROOT, "src/app/api/v1");
const EXPORT_ROUTE_FILE = "src/app/api/countries/[slug]/export/route.ts";
const API_DOCS_PAGE = "src/app/api-docs/page.tsx";

interface Report {
  errors: string[];
  info: string[];
}

function parseArgs(argv: string[]): { help: boolean } {
  return { help: argv.includes("--help") || argv.includes("-h") };
}

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function readFile(relPath: string): Promise<string> {
  return fs.readFile(path.join(ROOT, relPath), "utf8");
}

/** Recursively find every `route.ts` under a directory. */
async function findRouteFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findRouteFiles(full)));
    } else if (entry.isFile() && entry.name === "route.ts") {
      found.push(full);
    }
  }
  return found;
}

/** `.../src/app/api/v1/foo/[bar]/route.ts` -> `/api/v1/foo/:bar` */
export function filePathToPathTemplate(absOrRelRouteFile: string): string {
  const normalized = absOrRelRouteFile.replace(/\\/g, "/");
  const marker = "/src/app/";
  const idx = normalized.indexOf(marker);
  const rel =
    idx >= 0
      ? normalized.slice(idx + marker.length)
      : normalized.replace(/^src\/app\//, "");
  const withoutRoute = rel.replace(/\/route\.ts$/, "");
  const segments = withoutRoute
    .split("/")
    .map((seg) =>
      seg.startsWith("[") && seg.endsWith("]") ? `:${seg.slice(1, -1)}` : seg,
    );
  return `/${segments.join("/")}`;
}

// ─────────────────────────────────────────────────────────────────────
// 1. Route<->contract inventory — pure comparison functions
// ─────────────────────────────────────────────────────────────────────

/** Live `/api/v1/*` paths on disk with no matching registry entry
 *  (a route.ts that shipped without ever being registered). */
export function findPhantomRoutes(
  liveV1Paths: Set<string>,
  registry: Pick<RouteContract, "versioned" | "pathTemplate">[],
): string[] {
  const registryV1Paths = new Set(
    registry.filter((r) => r.versioned).map((r) => r.pathTemplate),
  );
  return [...liveV1Paths].filter((p) => !registryV1Paths.has(p)).sort();
}

/** Registry entries whose `filePath` does not exist among the known
 *  live files (a stale entry left behind after a route was renamed
 *  or deleted). */
export function findUncontractedEntries(
  registry: Pick<RouteContract, "id" | "filePath">[],
  knownFiles: Set<string>,
): string[] {
  return registry.filter((r) => !knownFiles.has(r.filePath)).map((r) => r.id);
}

async function checkInventory(report: Report): Promise<void> {
  const v1Files = await findRouteFiles(V1_DIR);
  const liveV1Paths = new Set(v1Files.map(filePathToPathTemplate));
  for (const p of findPhantomRoutes(liveV1Paths, API_ROUTES)) {
    report.errors.push(
      `[inventory] phantom route: ${p} exists on disk under src/app/api/v1 but has no contract/registry.ts entry`,
    );
  }

  const knownFiles = new Set<string>();
  for (const f of v1Files) knownFiles.add(path.relative(ROOT, f));
  if (await fileExists(path.join(ROOT, EXPORT_ROUTE_FILE)))
    knownFiles.add(EXPORT_ROUTE_FILE);

  for (const id of findUncontractedEntries(API_ROUTES, knownFiles)) {
    const route = API_ROUTES.find((r) => r.id === id)!;
    report.errors.push(
      `[inventory] uncontracted/stale entry: registry route "${id}" names ${route.filePath}, which does not exist`,
    );
  }

  if (!(await fileExists(path.join(ROOT, EXPORT_ROUTE_FILE)))) {
    report.errors.push(
      `[inventory] expected bulk export route missing: ${EXPORT_ROUTE_FILE}`,
    );
  }

  report.info.push(
    `[inventory] ${v1Files.length} live /api/v1 route file(s), ${API_ROUTES.length} registry entr(y/ies)`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 2. Docs coverage
// ─────────────────────────────────────────────────────────────────────

export function findUndocumentedRoutes(
  registry: Pick<RouteContract, "id" | "docSectionId">[],
  docsPageSource: string,
): string[] {
  return registry
    .filter(
      (r) =>
        !docsPageSource.includes(`id="${r.docSectionId}"`) ||
        !docsPageSource.includes(`routeId="${r.id}"`),
    )
    .map((r) => r.id);
}

async function checkDocsCoverage(report: Report): Promise<void> {
  const page = await readFile(API_DOCS_PAGE);
  for (const id of findUndocumentedRoutes(API_ROUTES, page)) {
    const route = API_ROUTES.find((r) => r.id === id)!;
    report.errors.push(
      `[docs-coverage] route "${route.id}" (${route.pathTemplate}) is not documented in ${API_DOCS_PAGE}` +
        (route.deprecation?.wholeRoute
          ? " (it is fully deprecated — an explicit deprecated-endpoint section is still required)"
          : ""),
    );
  }
  report.info.push(
    `[docs-coverage] checked ${API_ROUTES.length} registry route(s) against ${API_DOCS_PAGE}`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 3. Param drift
// ─────────────────────────────────────────────────────────────────────

export function extractQueryParamsRead(source: string): Set<string> {
  const found = new Set<string>();
  const re = /searchParams\.get(?:All)?\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) found.add(m[1]);
  return found;
}

export function extractPathParamsRead(source: string): Set<string> {
  const found = new Set<string>();
  const re = /params:\s*Promise<\{\s*([^}]*)\}>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    for (const field of m[1].split(";")) {
      const name = field.split(":")[0]?.trim();
      if (name) found.add(name);
    }
  }
  return found;
}

/** Cross-checks one route's declared params (registry) against what
 *  its source actually reads. Returns human-readable mismatch
 *  messages; empty array means no drift. */
export function diffParams(
  routeId: string,
  filePath: string,
  declaredParams: Pick<RouteContract["params"][number], "in" | "name">[],
  source: string,
): string[] {
  const errors: string[] = [];
  const queryRead = extractQueryParamsRead(source);
  const pathRead = new Set(
    [...extractPathParamsRead(source)].map((n) => `:${n}`),
  );
  const declaredQuery = new Set(
    declaredParams.filter((p) => p.in === "query").map((p) => p.name),
  );
  const declaredPath = new Set(
    declaredParams.filter((p) => p.in === "path").map((p) => p.name),
  );

  for (const name of declaredQuery) {
    if (!queryRead.has(name)) {
      errors.push(
        `[param-drift] route "${routeId}" documents query param "${name}" but no searchParams.get(All)("${name}") call was found in ${filePath}`,
      );
    }
  }
  for (const name of queryRead) {
    if (!declaredQuery.has(name)) {
      errors.push(
        `[param-drift] route "${routeId}" reads query param "${name}" (${filePath}) but it is not declared in contract/registry.ts`,
      );
    }
  }
  for (const name of declaredPath) {
    if (!pathRead.has(name)) {
      errors.push(
        `[param-drift] route "${routeId}" documents path param "${name}" but its route.ts params type does not destructure it`,
      );
    }
  }
  for (const name of pathRead) {
    if (!declaredPath.has(name)) {
      errors.push(
        `[param-drift] route "${routeId}" destructures path param "${name}" (${filePath}) but it is not declared in contract/registry.ts`,
      );
    }
  }
  return errors;
}

async function checkParamDrift(report: Report): Promise<void> {
  for (const route of API_ROUTES) {
    const source = await readFile(route.filePath);
    report.errors.push(
      ...diffParams(route.id, route.filePath, route.params, source),
    );
  }
  report.info.push(
    `[param-drift] checked ${API_ROUTES.length} route(s)' declared params against source`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 4. Deprecation consistency
// ─────────────────────────────────────────────────────────────────────

/** Null when consistent; an error message when a route's deprecation
 *  contract and its source's use of withStructuralFamilyDeprecation
 *  disagree (stripped deprecation, or an undeclared one). */
export function deprecationMismatch(
  routeId: string,
  filePath: string,
  hasDeprecationContract: boolean,
  source: string,
  helperName = "withStructuralFamilyDeprecation",
): string | null {
  const usesDeprecationHelper = source.includes(helperName);
  if (hasDeprecationContract && !usesDeprecationHelper) {
    return `[deprecation] route "${routeId}" declares a deprecation contract but ${filePath} never calls ${helperName}`;
  }
  if (!hasDeprecationContract && usesDeprecationHelper) {
    return `[deprecation] route "${routeId}" has no deprecation contract in the registry, but ${filePath} calls withStructuralFamilyDeprecation — stripped deprecation headers or a missing registry entry`;
  }
  return null;
}

export function deprecationScopeMismatch(
  routeId: string,
  filePath: string,
  appliesWhen: "always" | "taxonomy-structural-regime",
  source: string,
  helperName = "withStructuralFamilyDeprecation",
): string | null {
  if (appliesWhen === "always") {
    const rateLimitPattern = new RegExp(`if\\s*\\(rateLimited\\)\\s*return\\s+${helperName}\\(rateLimited\\)`);
    if (!rateLimitPattern.test(source)) {
      return `[deprecation] route "${routeId}" does not decorate its 429 rate-limit response in ${filePath}`;
    }
    return null;
  }

  const hasConditionalSignal =
    source.includes("isDeprecatedTaxonomy") &&
    source.includes("withStructuralFamilyDeprecation(rateLimited)") &&
    source.includes("withStructuralFamilyDeprecation(response)");
  return hasConditionalSignal
    ? null
    : `[deprecation] route "${routeId}" does not apply its conditional taxonomy deprecation consistently to success, 429, and 500 branches in ${filePath}`;
}

async function checkDeprecationConsistency(report: Report): Promise<void> {
  for (const route of API_ROUTES) {
    const source = await readFile(route.filePath);
    const mismatch = deprecationMismatch(
      route.id,
      route.filePath,
      route.deprecation !== null,
      source,
      route.deprecation?.helperName,
    );
    if (mismatch) report.errors.push(mismatch);
    if (route.deprecation) {
      const scopeMismatch = deprecationScopeMismatch(
        route.id,
        route.filePath,
        route.deprecation.appliesWhen,
        source,
        route.deprecation.helperName,
      );
      if (scopeMismatch) report.errors.push(scopeMismatch);
    }
  }
  report.info.push(
    `[deprecation] checked ${API_ROUTES.length} route(s) for header/registry consistency`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 5. Generated example validity
// ─────────────────────────────────────────────────────────────────────

async function checkExamples(report: Report): Promise<void> {
  let EXAMPLES: Record<string, unknown>;
  try {
    ({ EXAMPLES } = await import("../src/lib/api/contract/examples"));
  } catch (err) {
    report.errors.push(
      `[examples] importing contract/examples.ts threw — at least one canonical example failed schema validation: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return;
  }

  for (const route of API_ROUTES) {
    if (!(route.exampleId in EXAMPLES)) {
      report.errors.push(
        `[examples] route "${route.id}" declares exampleId "${route.exampleId}" but contract/examples.ts's EXAMPLES map has no such key`,
      );
    }
  }
  report.info.push(
    `[examples] contract/examples.ts imported cleanly; ${Object.keys(EXAMPLES).length} example(s) strict-validated at module load`,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 6. CSV header contract
// ─────────────────────────────────────────────────────────────────────

export function hasInlineCsvHeader(source: string): boolean {
  return /["'`]category,\s*key,\s*value/.test(source);
}

export function usesSharedCsvBuilder(source: string): boolean {
  return source.includes("countryResearchExportCsv");
}

export function isRightsBlockedExport(source: string): boolean {
  return (
    source.includes('evaluatePublicExport("country-export-json-csv"') &&
    source.includes("status: 503") &&
    !/Content-Disposition|attachment;/.test(source)
  );
}

async function checkCsvContract(report: Report): Promise<void> {
  const source = await readFile(EXPORT_ROUTE_FILE);
  if (isRightsBlockedExport(source)) {
    report.info.push(
      `[csv-contract] ${EXPORT_ROUTE_FILE} is withheld by the DAT-003 rights gate and emits no attachment`,
    );
    return;
  }
  if (!usesSharedCsvBuilder(source)) {
    report.errors.push(
      `[csv-contract] ${EXPORT_ROUTE_FILE} no longer calls countryResearchExportCsv — JSON/CSV observation semantics may drift`,
    );
  }
  if (hasInlineCsvHeader(source)) {
    report.errors.push(
      `[csv-contract] ${EXPORT_ROUTE_FILE} contains a hand-typed CSV header string literal — it must come from COUNTRY_EXPORT_CSV_COLUMNS/COUNTRY_EXPORT_CSV_HEADER in contract/csv.ts instead`,
    );
  }
  if (
    report.errors.filter((e) => e.startsWith("[csv-contract]")).length === 0
  ) {
    report.info.push(
      `[csv-contract] ${EXPORT_ROUTE_FILE} uses the shared DAT-027 JSON/CSV export builder`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

function assertNoDuplicateRegistryIds(report: Report): void {
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  for (const route of API_ROUTES) {
    if (seenIds.has(route.id)) {
      report.errors.push(
        `[registry] duplicate route id in contract/registry.ts: "${route.id}"`,
      );
    }
    seenIds.add(route.id);
    const key = `${route.method} ${route.pathTemplate}`;
    if (seenPaths.has(key)) {
      report.errors.push(
        `[registry] duplicate path+method in contract/registry.ts: ${key}`,
      );
    }
    seenPaths.add(key);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      [
        "validate-api-docs — CLM-012 public API contract validator",
        "",
        "Usage:",
        "  npm run validate:api-docs",
        "",
        "Deterministic, DB-free, network-free. Checks route<->contract",
        "inventory, docs coverage, param drift, deprecation header",
        "consistency, generated example validity, and the CSV header",
        "contract.",
      ].join("\n"),
    );
    process.exit(0);
  }

  console.log("=== Civica API docs validation (CLM-012) ===\n");

  const report: Report = { errors: [], info: [] };

  assertNoDuplicateRegistryIds(report);
  await checkInventory(report);
  await checkDocsCoverage(report);
  await checkParamDrift(report);
  await checkDeprecationConsistency(report);
  await checkExamples(report);
  await checkCsvContract(report);

  for (const line of report.info) console.log(`✓ ${line}`);
  console.log("");

  if (report.errors.length > 0) {
    console.error(`${report.errors.length} error(s):\n`);
    for (const line of report.errors) console.error(`✗ ${line}`);
    process.exit(1);
  }

  console.log("All api-docs checks passed.");
}

// Only run the CLI when this file is executed directly (`tsx
// scripts/validate-api-docs.ts`) — `contract/__tests__/contract.test.ts`
// imports this module's pure functions (findPhantomRoutes, diffParams,
// etc.) for negative-fixture coverage and must not also trigger a full
// validation run (with its own process.exit) as an import side effect.
const isMainModule =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
