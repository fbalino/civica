/**
 * PLT-014 — closed cache/freshness consistency gate.
 *
 * DB-free and network-free. The gate closes four inventories:
 *   1. every HTTP method exported by an App Router route file;
 *   2. every canonical data-export module;
 *   3. every exported async function in src/lib/db/queries*.ts;
 *   4. every App Router page, including its implicit ancestor layouts.
 *
 * Mutable database dependencies are discovered through a cross-file runtime
 * import graph. A database-dependent page route must resolve to an effective
 * literal `revalidate = 0`. Build-only pages remain eligible for static or
 * time-revalidated output. Persistent cache APIs are forbidden in DB query
 * modules, while React's render-pass-only `cache()` remains allowed.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

import {
  CACHE_PROFILES,
  EXPORT_FRESHNESS_POLICY,
  ROUTE_FRESHNESS_POLICY,
  cacheProfileErrors,
  exportFreshnessPolicyErrors,
  routeFreshnessPolicyErrors,
  type ExportFreshnessPolicy,
  type RouteFreshnessPolicy,
} from "../src/lib/platform/cache-consistency";
import {
  ROUTE_INVENTORY,
  type HttpMethod,
} from "../src/lib/api/route-inventory/registry";
import {
  isRepositoryOwned,
  loadRepositoryOwnedFiles,
} from "./repository-owned-files";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const TSCONFIG_PATH = path.join(ROOT, "tsconfig.json");
const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
]);
const IGNORED_LOCAL_EXTENSIONS = new Set([
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".woff",
  ".woff2",
]);

export type RevalidateValue = number | "non-literal" | null;

export interface SourceModuleFacts {
  filePath: string;
  runtimeImports: string[];
  exportedValueNames: string[];
  exportedAsyncFunctions: string[];
  exportedHttpMethods: string[];
  revalidate: RevalidateValue;
  persistentCacheApis: string[];
  source: string;
}

export interface ImportGraph {
  edges: Map<string, string[]>;
  unresolvedLocalImports: string[];
}

export interface PageRouteObservation {
  pageFile: string;
  routeModules: string[];
  dependencyPath: string[] | null;
  effectiveRevalidate: number | null;
}

function posixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function repoRelative(absolutePath: string): string {
  return posixPath(path.relative(ROOT, absolutePath));
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return Boolean(
    ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((modifier) => modifier.kind === kind),
  );
}

function isExported(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

function isAsyncFunctionLike(node: ts.Node | undefined): boolean {
  return Boolean(node && hasModifier(node, ts.SyntaxKind.AsyncKeyword));
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function numericLiteralValue(expression: ts.Expression): number | null {
  const unwrapped = unwrapExpression(expression);
  if (ts.isNumericLiteral(unwrapped)) return Number(unwrapped.text);
  if (
    ts.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(unwrapped.operand)
  ) {
    return -Number(unwrapped.operand.text);
  }
  return null;
}

function importHasRuntimeValue(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  if (!clause.namedBindings) return false;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function exportHasRuntimeValue(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) return false;
  if (!node.exportClause || !ts.isNamedExports(node.exportClause)) return true;
  return node.exportClause.elements.some((element) => !element.isTypeOnly);
}

/** Parse one TS/TSX source module without executing it. */
export function inspectSourceModule(
  filePath: string,
  source: string,
): SourceModuleFacts {
  const scriptKind = filePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : filePath.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : /\.[cm]?js$/.test(filePath)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const runtimeImports = new Set<string>();
  const exportedValueNames = new Set<string>();
  const exportedAsyncFunctions = new Set<string>();
  const exportedHttpMethods = new Set<string>();
  const persistentCacheApis = new Set<string>();
  let revalidate: RevalidateValue = null;
  let revalidateDeclarations = 0;

  for (const statement of sourceFile.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      /^use cache(?::|$)/.test(statement.expression.text)
    ) {
      persistentCacheApis.add(`directive:${statement.expression.text}`);
    }

    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const specifier = statement.moduleSpecifier.text;
      if (importHasRuntimeValue(statement)) runtimeImports.add(specifier);
      if (specifier === "next/cache") persistentCacheApis.add("import:next/cache");
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      exportHasRuntimeValue(statement)
    ) {
      runtimeImports.add(statement.moduleSpecifier.text);
    }

    if (ts.isFunctionDeclaration(statement) && statement.name && isExported(statement)) {
      const name = statement.name.text;
      exportedValueNames.add(name);
      if (isAsyncFunctionLike(statement)) exportedAsyncFunctions.add(name);
      if (HTTP_METHODS.has(name)) exportedHttpMethods.add(name);
    }

    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        exportedValueNames.add(name);
        if (
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer)) &&
          isAsyncFunctionLike(declaration.initializer)
        ) {
          exportedAsyncFunctions.add(name);
        }
        if (HTTP_METHODS.has(name)) exportedHttpMethods.add(name);
        if (name === "revalidate") {
          revalidateDeclarations += 1;
          revalidate = declaration.initializer
            ? (numericLiteralValue(declaration.initializer) ?? "non-literal")
            : "non-literal";
        }
      }
    }

    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (element.isTypeOnly) continue;
        const name = element.name.text;
        exportedValueNames.add(name);
        if (HTTP_METHODS.has(name)) exportedHttpMethods.add(name);
      }
    }
  }

  if (revalidateDeclarations > 1) revalidate = "non-literal";

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      runtimeImports.add(node.arguments[0].text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      runtimeImports.add(node.arguments[0].text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["unstable_cache", "cacheTag", "cacheLife"].includes(node.expression.text)
    ) {
      persistentCacheApis.add(`call:${node.expression.text}`);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "fetch" &&
      node.arguments[1]
    ) {
      const options = node.arguments[1].getText(sourceFile);
      if (/\bcache\s*:\s*["']force-cache["']/.test(options)) {
        persistentCacheApis.add("fetch:force-cache");
      }
      if (/\bnext\s*:\s*\{[\s\S]*\b(?:revalidate|tags)\s*:/.test(options)) {
        persistentCacheApis.add("fetch:next-cache-options");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return {
    filePath,
    runtimeImports: [...runtimeImports].sort(),
    exportedValueNames: [...exportedValueNames].sort(),
    exportedAsyncFunctions: [...exportedAsyncFunctions].sort(),
    exportedHttpMethods: [...exportedHttpMethods].sort(),
    revalidate,
    persistentCacheApis: [...persistentCacheApis].sort(),
    source,
  };
}

export function isRepoLocalSpecifier(specifier: string): boolean {
  return specifier.startsWith("@/") || specifier.startsWith("./") || specifier.startsWith("../");
}

function ignoredLocalAsset(specifier: string): boolean {
  return IGNORED_LOCAL_EXTENSIONS.has(path.posix.extname(specifier));
}

/** Build a deterministic repo-local import graph with an injectable resolver. */
export function buildImportGraph(
  modules: readonly SourceModuleFacts[],
  resolveImport: (fromFile: string, specifier: string) => string | null,
): ImportGraph {
  const edges = new Map<string, string[]>();
  const unresolvedLocalImports: string[] = [];
  for (const sourceModule of [...modules].sort((a, b) =>
    a.filePath.localeCompare(b.filePath),
  )) {
    const dependencies = new Set<string>();
    for (const specifier of sourceModule.runtimeImports) {
      const resolved = resolveImport(sourceModule.filePath, specifier);
      if (resolved) dependencies.add(resolved);
      else if (isRepoLocalSpecifier(specifier) && !ignoredLocalAsset(specifier)) {
        unresolvedLocalImports.push(`${sourceModule.filePath} -> ${specifier}`);
      }
    }
    edges.set(sourceModule.filePath, [...dependencies].sort());
  }
  return { edges, unresolvedLocalImports: unresolvedLocalImports.sort() };
}

/** Return the shortest witness path from any start module to a mutable root. */
export function shortestDependencyPath(
  graph: ReadonlyMap<string, readonly string[]>,
  startFiles: readonly string[],
  targets: ReadonlySet<string>,
): string[] | null {
  const queue = [...new Set(startFiles)].sort().map((file) => [file]);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const currentPath = queue.shift()!;
    const current = currentPath[currentPath.length - 1];
    if (visited.has(current)) continue;
    visited.add(current);
    if (targets.has(current)) return currentPath;
    for (const next of graph.get(current) ?? []) {
      if (!visited.has(next)) queue.push([...currentPath, next]);
    }
  }
  return null;
}

/** DB-dependent routes must have an effective literal zero revalidation. */
export function pageRevalidationErrors(
  observations: readonly PageRouteObservation[],
): string[] {
  const errors: string[] = [];
  for (const observation of observations) {
    if (!observation.dependencyPath) continue;
    if (observation.effectiveRevalidate === 0) continue;
    const actual =
      observation.effectiveRevalidate === null
        ? "no literal route-level revalidate"
        : `effective revalidate=${observation.effectiveRevalidate}`;
    errors.push(
      `${observation.pageFile}: reaches mutable DB data but has ${actual}; ` +
        `require an effective literal revalidate=0; dependency: ${observation.dependencyPath.join(" -> ")}`,
    );
  }
  return errors.sort();
}

export function routeMethodCoverageErrors(
  diskKeys: readonly string[],
  policies: readonly RouteFreshnessPolicy[],
): string[] {
  const errors: string[] = [];
  const disk = new Set(diskKeys);
  const policyKeys = policies.map((policy) => `${policy.filePath}#${policy.method}`);
  const policy = new Set(policyKeys);
  for (const key of disk) {
    if (!policy.has(key)) errors.push(`${key}: route method has no cache policy`);
  }
  for (const key of policy) {
    if (!disk.has(key)) errors.push(`${key}: cache policy has no route method on disk`);
  }
  return errors.sort();
}

export function exportModuleCoverageErrors(
  discoveredFiles: readonly string[],
  policies: readonly ExportFreshnessPolicy[],
  factsByFile: ReadonlyMap<string, SourceModuleFacts>,
): string[] {
  const errors: string[] = [];
  const discovered = new Set(discoveredFiles);
  const declared = new Set(policies.map((policy) => policy.filePath));
  for (const file of discovered) {
    if (!declared.has(file)) errors.push(`${file}: export module has no freshness policy`);
  }
  for (const policy of policies) {
    if (!discovered.has(policy.filePath)) {
      errors.push(`${policy.filePath}: export freshness policy has no module on disk`);
      continue;
    }
    const facts = factsByFile.get(policy.filePath);
    if (!facts?.exportedValueNames.includes(policy.builder)) {
      errors.push(`${policy.filePath}: declared builder ${policy.builder} is not exported`);
    }
  }
  return errors.sort();
}

function isTestOrDeclaration(filePath: string): boolean {
  return (
    /(?:^|\/)__tests__(?:\/|$)/.test(filePath) ||
    /\.(?:test|spec)\.[^.]+$/.test(filePath) ||
    filePath.endsWith(".d.ts")
  );
}

async function walkSourceFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkSourceFiles(absolute)));
    else if (
      entry.isFile() &&
      SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
      !isTestOrDeclaration(repoRelative(absolute))
    ) {
      files.push(absolute);
    }
  }
  return files.sort();
}

function loadCompilerOptions(): ts.CompilerOptions {
  const config = ts.readConfigFile(TSCONFIG_PATH, ts.sys.readFile);
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  }
  return ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT).options;
}

function typescriptResolver(
  compilerOptions: ts.CompilerOptions,
): (fromFile: string, specifier: string) => string | null {
  return (fromFile, specifier) => {
    if (!isRepoLocalSpecifier(specifier)) return null;
    const resolved = ts.resolveModuleName(
      specifier,
      path.join(ROOT, fromFile),
      compilerOptions,
      ts.sys,
    ).resolvedModule?.resolvedFileName;
    if (!resolved) return null;
    const relative = repoRelative(resolved.replace(/\.d\.ts$/, ".ts"));
    return relative.startsWith("../") ? null : relative;
  };
}

function isRouteFile(filePath: string): boolean {
  return /^src\/app\/.+\/route\.[cm]?[jt]sx?$/.test(filePath);
}

function isCanonicalExportModule(filePath: string): boolean {
  const base = path.posix.basename(filePath);
  return (
    /-export\.[cm]?[jt]sx?$/.test(base) ||
    /^coding-export\.[cm]?[jt]sx?$/.test(base) ||
    /^research-export\.[cm]?[jt]sx?$/.test(base) ||
    /^src\/lib\/exports\/atlas-release\.[cm]?[jt]sx?$/.test(filePath)
  );
}

function isDbQueryModule(filePath: string): boolean {
  return /^src\/lib\/db\/queries(?:-[^/]+)?\.[cm]?[jt]sx?$/.test(filePath);
}

function routeModulesForPage(pageFile: string, files: ReadonlySet<string>): string[] {
  const modules = new Set<string>([pageFile]);
  if (/^src\/app\/(?:sitemap|robots)\.[cm]?[jt]sx?$/.test(pageFile)) {
    return [...modules];
  }
  let directory = path.posix.dirname(pageFile);
  const stop = "src/app";
  while (directory === stop || directory.startsWith(`${stop}/`)) {
    for (const stem of ["layout", "template"]) {
      for (const extension of ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"]) {
        const candidate = `${directory}/${stem}.${extension}`;
        if (files.has(candidate)) modules.add(candidate);
      }
    }
    if (directory === stop) break;
    directory = path.posix.dirname(directory);
  }
  return [...modules].sort();
}

function pageSurfaceFiles(files: ReadonlySet<string>): string[] {
  const surfaces = [...files].filter(
    (file) =>
      /^src\/app\/.+\/page\.[cm]?[jt]sx?$/.test(file) ||
      /^src\/app\/(?:page|not-found|sitemap|robots)\.[cm]?[jt]sx?$/.test(file),
  );
  return surfaces.sort();
}

function effectiveRevalidate(
  routeModules: readonly string[],
  factsByFile: ReadonlyMap<string, SourceModuleFacts>,
): number | null {
  const values = routeModules
    .map((file) => factsByFile.get(file)?.revalidate ?? null)
    .filter((value): value is number => typeof value === "number");
  return values.length > 0 ? Math.min(...values) : null;
}

function directCacheControlValues(source: string): string[] {
  const values = new Set<string>();
  for (const pattern of [
    /["']cache-control["']\s*:\s*["']([^"']+)["']/gi,
    /\.set\(\s*["']cache-control["']\s*,\s*["']([^"']+)["']\s*\)/gi,
  ]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) values.add(match[1]);
  }
  return [...values].sort();
}

type RouteHttpProfileId = RouteFreshnessPolicy["profileId"];

export type RouteResponseCacheFindingKind =
  | "handler-missing"
  | "boundary-profile-mismatch"
  | "response-cache-missing"
  | "response-cache-contradiction"
  | "response-boundary-missing"
  | "response-return-unverified";

export interface RouteResponseCacheFinding {
  kind: RouteResponseCacheFindingKind;
  line: number;
  detail: string;
}

export interface RouteResponseCacheReport {
  handlerFound: boolean;
  responseSites: number;
  boundarySites: number;
  findings: RouteResponseCacheFinding[];
}

type RouteCallable =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction;
type RouteHandlerRoot = RouteCallable | ts.CallExpression;

function cacheCallName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    return `${cacheCallName(expression.expression)}.${expression.name.text}`;
  }
  return expression.getText();
}

function cacheUnwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAwaitExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function cachePropertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) ||
    ts.isStringLiteralLike(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : undefined;
}

function cacheObjectProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find(
    (property) =>
      "name" in property &&
      !!property.name &&
      cachePropertyName(property.name)?.toLowerCase() === name.toLowerCase(),
  );
}

function cacheLineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function cacheBoundaryIsReturned(node: ts.CallExpression): boolean {
  let current: ts.Node = node;
  while (
    current.parent &&
    (ts.isParenthesizedExpression(current.parent) ||
      ts.isAwaitExpression(current.parent) ||
      ts.isAsExpression(current.parent) ||
      ts.isTypeAssertionExpression(current.parent) ||
      ts.isSatisfiesExpression(current.parent))
  ) {
    current = current.parent;
  }
  return Boolean(current.parent && ts.isReturnStatement(current.parent));
}

function cacheLocalCallables(source: ts.SourceFile): Map<string, RouteCallable> {
  const callables = new Map<string, RouteCallable>();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      callables.set(statement.name.text, statement);
      continue;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer))
      ) {
        callables.set(declaration.name.text, declaration.initializer);
      }
    }
  }
  return callables;
}

function cacheExportedHandler(
  source: ts.SourceFile,
  method: HttpMethod,
  callables: ReadonlyMap<string, RouteCallable>,
): RouteHandlerRoot | undefined {
  for (const statement of source.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === method &&
      isExported(statement)
    ) {
      return statement;
    }
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === method &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          return declaration.initializer;
        }
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      const alias = statement.exportClause.elements.find(
        (element) => element.name.text === method,
      );
      if (alias) {
        const localName = (alias.propertyName ?? alias.name).text;
        const callable = callables.get(localName);
        if (callable) return callable;
        for (const candidate of source.statements) {
          if (!ts.isVariableStatement(candidate)) continue;
          for (const declaration of candidate.declarationList.declarations) {
            if (
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === localName &&
              declaration.initializer &&
              ts.isCallExpression(
                cacheUnwrapExpression(declaration.initializer),
              )
            ) {
              return cacheUnwrapExpression(
                declaration.initializer,
              ) as ts.CallExpression;
            }
          }
        }
      }
    }
  }
  return undefined;
}

function cacheNamedImportSource(
  source: ts.SourceFile,
  name: string,
): string | null {
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const matched = bindings.elements.some(
      (element) =>
        element.name.text === name &&
        (element.propertyName ?? element.name).text === name,
    );
    if (matched) return statement.moduleSpecifier.text;
  }
  return null;
}

const FIXED_CACHE_BOUNDARIES = new Map<
  string,
  { module: string; profileId: RouteHttpProfileId }
>([
  [
    "withSafeJsonErrors",
    {
      module: "@/lib/api/problem-response",
      profileId: "public-live",
    },
  ],
  [
    "withPrivateSafeJsonErrors",
    {
      module: "@/lib/api/problem-response",
      profileId: "private-live",
    },
  ],
  [
    "withCronJob",
    { module: "@/lib/api/cron-job", profileId: "private-live" },
  ],
  [
    "withAdminMutation",
    { module: "@/lib/admin/mutation", profileId: "private-live" },
  ],
  [
    "withAdminLogout",
    { module: "@/lib/admin/logout", profileId: "private-live" },
  ],
]);

const FIXED_RESPONSE_HELPERS = new Map<
  string,
  {
    module: string;
    profileId: RouteHttpProfileId | "error-no-store";
  }
>([
  [
    "apiResponse",
    { module: "@/lib/api/helpers", profileId: "public-live" },
  ],
  [
    "corsOptions",
    { module: "@/lib/api/helpers", profileId: "public-live" },
  ],
  [
    "apiProblem",
    { module: "@/lib/api/problem-response", profileId: "error-no-store" },
  ],
  [
    "requestInputErrorResponse",
    { module: "@/lib/api/request-body", profileId: "error-no-store" },
  ],
  [
    "rateLimitResponse",
    { module: "@/lib/api/rate-limit-request", profileId: "error-no-store" },
  ],
  [
    "enforceRequestRateLimit",
    { module: "@/lib/api/rate-limit-request", profileId: "error-no-store" },
  ],
  [
    "withRateLimit",
    { module: "@/lib/api/helpers", profileId: "error-no-store" },
  ],
  [
    "retiredIndexApiResponse",
    { module: "@/lib/api/deprecation", profileId: "error-no-store" },
  ],
  [
    "retiredPulseScalarResponse",
    {
      module: "@/lib/api/pulse-scalar-retirement",
      profileId: "error-no-store",
    },
  ],
  [
    "immutableArtifactResponse",
    {
      module: "@/lib/api/artifact-response",
      profileId: "immutable-release",
    },
  ],
]);

function literalProfileArgument(
  expression: ts.Expression | undefined,
): RouteHttpProfileId | null {
  if (!expression) return null;
  const value = cacheUnwrapExpression(expression);
  if (!ts.isStringLiteralLike(value)) return null;
  return value.text in CACHE_PROFILES
    ? (value.text as RouteHttpProfileId)
    : null;
}

function responseOptions(
  node: ts.CallExpression | ts.NewExpression,
  name: string,
): ts.Expression | undefined {
  const args = node.arguments ?? [];
  if (name === "NextResponse.redirect" || name === "Response.redirect") {
    return undefined;
  }
  return args[1];
}

function responseStatus(
  node: ts.CallExpression | ts.NewExpression,
  name: string,
): number | null {
  const args = node.arguments ?? [];
  if (name === "NextResponse.redirect" || name === "Response.redirect") {
    const status = args[1] && cacheUnwrapExpression(args[1]);
    return status && ts.isNumericLiteral(status) ? Number(status.text) : 307;
  }
  const options = responseOptions(node, name);
  const value = options && cacheUnwrapExpression(options);
  if (!value || !ts.isObjectLiteralExpression(value)) return 200;
  const status = cacheObjectProperty(value, "status");
  if (!status || !ts.isPropertyAssignment(status)) return 200;
  const initializer = cacheUnwrapExpression(status.initializer);
  return ts.isNumericLiteral(initializer) ? Number(initializer.text) : null;
}

function directResponseCacheValue(
  source: ts.SourceFile,
  node: ts.CallExpression | ts.NewExpression,
  name: string,
): string | null {
  const options = responseOptions(node, name);
  const value = options && cacheUnwrapExpression(options);
  if (!value || !ts.isObjectLiteralExpression(value)) return null;
  const headers = cacheObjectProperty(value, "headers");
  if (!headers || !ts.isPropertyAssignment(headers)) return null;
  const headerValue = cacheUnwrapExpression(headers.initializer);
  if (!ts.isObjectLiteralExpression(headerValue)) return null;
  const cacheControl = cacheObjectProperty(headerValue, "Cache-Control");
  if (!cacheControl || !ts.isPropertyAssignment(cacheControl)) return null;
  return cacheControlExpressionValue(source, cacheControl.initializer);
}

function cacheControlExpressionValue(
  source: ts.SourceFile,
  expression: ts.Expression,
): string | null {
  const initializer = cacheUnwrapExpression(expression);
  if (ts.isStringLiteralLike(initializer)) return initializer.text;
  if (
    ts.isCallExpression(initializer) &&
    ts.isIdentifier(initializer.expression) &&
    initializer.expression.text === "cacheControlFor" &&
    cacheNamedImportSource(source, "cacheControlFor") ===
      "@/lib/platform/cache-consistency"
  ) {
    const profileId = literalProfileArgument(initializer.arguments[0]);
    return profileId ? CACHE_PROFILES[profileId].cacheControl : null;
  }
  return null;
}

function directResponseName(
  node: ts.CallExpression | ts.NewExpression,
): string | null {
  if (ts.isCallExpression(node)) {
    const name = cacheCallName(node.expression);
    return [
      "NextResponse.json",
      "NextResponse.redirect",
      "Response.json",
      "Response.redirect",
    ].includes(name)
      ? name
      : null;
  }
  const name = node.expression && cacheCallName(node.expression);
  return name === "Response" || name === "NextResponse" ? name : null;
}

/**
 * Inspect response producers reachable through one route module's exported
 * handler and local helper calls. Canonical final-response boundaries close
 * every nested branch; otherwise each direct success producer must declare
 * the registered profile and each error helper must be explicitly no-store.
 */
export function inspectHandlerCacheProfile(
  sourceText: string,
  method: HttpMethod,
  profileId: RouteHttpProfileId,
  fileName = "route.ts",
): RouteResponseCacheReport {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const callables = cacheLocalCallables(source);
  const handler = cacheExportedHandler(source, method, callables);
  if (!handler || (!ts.isCallExpression(handler) && !handler.body)) {
    return {
      handlerFound: false,
      responseSites: 0,
      boundarySites: 0,
      findings: [
        {
          kind: "handler-missing",
          line: 1,
          detail: `exported ${method} handler is missing`,
        },
      ],
    };
  }

  const findings: RouteResponseCacheFinding[] = [];
  let responseSites = 0;
  let boundarySites = 0;
  const visited = new Set<RouteCallable>();

  const recordBoundary = (
    node: ts.CallExpression,
    actualProfileId: RouteHttpProfileId | null,
    name: string,
  ): void => {
    boundarySites += 1;
    if (actualProfileId !== profileId) {
      findings.push({
        kind: "boundary-profile-mismatch",
        line: cacheLineOf(source, node),
        detail: `${name} seals ${actualProfileId ?? "an unknown profile"}; expected ${profileId}`,
      });
    }
  };

  const visitCallable = (callable: RouteCallable): void => {
    if (visited.has(callable)) return;
    visited.add(callable);
    if (callable.body) visit(callable.body);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        const fixedBoundary = FIXED_CACHE_BOUNDARIES.get(name);
        if (
          fixedBoundary &&
          cacheNamedImportSource(source, name) === fixedBoundary.module &&
          (node === handler || cacheBoundaryIsReturned(node))
        ) {
          recordBoundary(node, fixedBoundary.profileId, name);
          return;
        }
        if (
          name === "withResponseCacheProfile" &&
          cacheNamedImportSource(source, name) ===
            "@/lib/api/response-cache" &&
          cacheBoundaryIsReturned(node)
        ) {
          recordBoundary(node, literalProfileArgument(node.arguments[0]), name);
          return;
        }
        if (
          name === "responseWithCacheProfile" &&
          cacheNamedImportSource(source, name) ===
            "@/lib/api/response-cache" &&
          cacheBoundaryIsReturned(node)
        ) {
          recordBoundary(node, literalProfileArgument(node.arguments[1]), name);
          return;
        }

        const helper = FIXED_RESPONSE_HELPERS.get(name);
        if (helper && cacheNamedImportSource(source, name) === helper.module) {
          responseSites += 1;
          if (
            helper.profileId !== "error-no-store" &&
            helper.profileId !== profileId
          ) {
            findings.push({
              kind: "response-cache-contradiction",
              line: cacheLineOf(source, node),
              detail: `${name} emits ${helper.profileId}; expected ${profileId}`,
            });
          }
        }

        const local = callables.get(name);
        if (local) visitCallable(local);
      }

      const directName = directResponseName(node);
      if (directName) {
        responseSites += 1;
        const actual = directResponseCacheValue(source, node, directName);
        const expected = CACHE_PROFILES[profileId].cacheControl;
        const status = responseStatus(node, directName);
        const errorNoStore =
          status !== null &&
          status >= 400 &&
          actual?.toLowerCase().split(",").some((part) => part.trim() === "no-store");
        if (!actual) {
          findings.push({
            kind: "response-cache-missing",
            line: cacheLineOf(source, node),
            detail: `${directName} can return without a verifiable Cache-Control`,
          });
        } else if (actual !== expected && !errorNoStore) {
          findings.push({
            kind: "response-cache-contradiction",
            line: cacheLineOf(source, node),
            detail: `${directName} emits ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}`,
          });
        }
      }

      for (const argument of node.arguments) {
        if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) {
          visitCallable(argument);
        } else {
          visit(argument);
        }
      }
      return;
    }

    if (ts.isNewExpression(node)) {
      const directName = directResponseName(node);
      if (directName) {
        responseSites += 1;
        const actual = directResponseCacheValue(source, node, directName);
        const expected = CACHE_PROFILES[profileId].cacheControl;
        const status = responseStatus(node, directName);
        const errorNoStore =
          status !== null &&
          status >= 400 &&
          actual?.toLowerCase().split(",").some((part) => part.trim() === "no-store");
        if (!actual) {
          findings.push({
            kind: "response-cache-missing",
            line: cacheLineOf(source, node),
            detail: `${directName} can return without a verifiable Cache-Control`,
          });
        } else if (actual !== expected && !errorNoStore) {
          findings.push({
            kind: "response-cache-contradiction",
            line: cacheLineOf(source, node),
            detail: `${directName} emits ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}`,
          });
        }
      }
    }

    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      return;
    }
    ts.forEachChild(node, visit);
  };

  if (ts.isCallExpression(handler)) visit(handler);
  else visitCallable(handler);
  if (responseSites === 0 && boundarySites === 0) {
    findings.push({
      kind: "response-boundary-missing",
      line: cacheLineOf(source, handler),
      detail: "handler has no verifiable response cache boundary or producer",
    });
  }
  return {
    handlerFound: true,
    responseSites,
    boundarySites,
    findings,
  };
}

async function main(): Promise<void> {
  const ownedFiles = loadRepositoryOwnedFiles(ROOT);
  const absoluteFiles = await walkSourceFiles(SRC_DIR);
  const facts: SourceModuleFacts[] = [];
  for (const absolute of absoluteFiles) {
    const filePath = repoRelative(absolute);
    const source = filePath.endsWith(".json")
      ? ""
      : await fs.readFile(absolute, "utf8");
    facts.push(inspectSourceModule(filePath, source));
  }
  const factsByFile = new Map(facts.map((item) => [item.filePath, item]));
  const files = new Set(facts.map((item) => item.filePath));
  const graph = buildImportGraph(facts, typescriptResolver(loadCompilerOptions()));
  const dbRoots = new Set(
    facts
      .filter((item) => item.runtimeImports.includes("@neondatabase/serverless"))
      .map((item) => item.filePath),
  );

  const errors: string[] = [];
  errors.push(...cacheProfileErrors().map((error) => `[profiles] ${error}`));
  errors.push(
    ...routeFreshnessPolicyErrors(
      ROUTE_INVENTORY,
      ROUTE_FRESHNESS_POLICY,
    ).map((error) => `[api-policy] ${error}`),
  );
  errors.push(
    ...exportFreshnessPolicyErrors().map((error) => `[exports] ${error}`),
  );
  errors.push(
    ...graph.unresolvedLocalImports.map(
      (edge) => `[import-graph] unresolved runtime import ${edge}`,
    ),
  );

  const routeFacts = facts.filter(
    (item) =>
      isRouteFile(item.filePath) && isRepositoryOwned(item.filePath, ownedFiles),
  );
  const diskMethodKeys = routeFacts.flatMap((item) =>
    item.exportedHttpMethods.map(
      (method) => `${item.filePath.replace(/^src\/app\//, "")}#${method}`,
    ),
  );
  errors.push(
    ...routeMethodCoverageErrors(
      diskMethodKeys,
      ROUTE_FRESHNESS_POLICY,
    ).map((error) => `[api-closure] ${error}`),
  );

  for (const policy of ROUTE_FRESHNESS_POLICY) {
    const filePath = `src/app/${policy.filePath}`;
    const route = factsByFile.get(filePath);
    if (!route) continue;
    const profile = CACHE_PROFILES[policy.profileId];
    const responseReport = inspectHandlerCacheProfile(
      route.source,
      policy.method,
      policy.profileId,
      filePath,
    );
    for (const finding of responseReport.findings) {
      errors.push(
        `[api-response-cache] ${policy.filePath}#${policy.method}:${finding.line} [${finding.kind}] ${finding.detail}`,
      );
    }
    if (
      profile.nextRouteBehavior === "request-dynamic" &&
      typeof route.revalidate === "number" &&
      route.revalidate > 0
    ) {
      errors.push(
        `[api-cache] ${policy.filePath}#${policy.method}: request-live route declares revalidate=${route.revalidate}`,
      );
    }
    if (
      policy.profileId === "checked-build-artifact" &&
      !route.source.includes('cacheControlFor("checked-build-artifact")')
    ) {
      errors.push(
        `[api-cache] ${policy.filePath}#${policy.method}: checked artifact does not use its canonical cache profile`,
      );
    }
    if (
      policy.profileId === "immutable-release" &&
      !/immutableArtifactResponse|cacheControlFor\(["']immutable-release["']\)/.test(
        route.source,
      )
    ) {
      errors.push(
        `[api-cache] ${policy.filePath}#${policy.method}: immutable release does not use its canonical cache boundary`,
      );
    }
    if (profile.nextRouteBehavior === "request-dynamic") {
      for (const value of directCacheControlValues(route.source)) {
        if (/\b(?:max-age|s-maxage|stale-|immutable|no-cache)\b/i.test(value)) {
          errors.push(
            `[api-cache] ${policy.filePath}#${policy.method}: request-live route declares cacheable Cache-Control ${JSON.stringify(value)}`,
          );
        }
      }
    } else {
      const witness = shortestDependencyPath(graph.edges, [filePath], dbRoots);
      if (witness) {
        errors.push(
          `[api-cache] ${policy.filePath}#${policy.method}: shared-cache route reaches mutable DB data: ${witness.join(" -> ")}`,
        );
      }
    }
  }

  const exportModules = facts
    .filter((item) => isCanonicalExportModule(item.filePath))
    .map((item) => item.filePath)
    .sort();
  errors.push(
    ...exportModuleCoverageErrors(
      exportModules,
      EXPORT_FRESHNESS_POLICY,
      factsByFile,
    ).map((error) => `[exports] ${error}`),
  );

  const queryModules = facts.filter((item) => isDbQueryModule(item.filePath));
  const queryFunctions = queryModules.flatMap((item) =>
    item.exportedAsyncFunctions.map((name) => `${item.filePath}#${name}`),
  );
  for (const queryModule of queryModules) {
    if (queryModule.exportedAsyncFunctions.length === 0) {
      errors.push(
        `[queries] ${queryModule.filePath}: query module exports no async query functions`,
      );
    }
    for (const api of queryModule.persistentCacheApis) {
      errors.push(
        `[queries] ${queryModule.filePath}: persistent cache API is forbidden (${api})`,
      );
    }
  }

  const pageFiles = pageSurfaceFiles(files);
  const pageObservations = pageFiles.map((pageFile) => {
    const routeModules = routeModulesForPage(pageFile, files);
    return {
      pageFile,
      routeModules,
      dependencyPath: shortestDependencyPath(graph.edges, routeModules, dbRoots),
      effectiveRevalidate: effectiveRevalidate(routeModules, factsByFile),
    } satisfies PageRouteObservation;
  });
  errors.push(
    ...pageRevalidationErrors(pageObservations).map(
      (error) => `[pages] ${error}`,
    ),
  );

  const dbDependentPages = pageObservations.filter(
    (observation) => observation.dependencyPath,
  );
  const buildOnlyPages = pageObservations.length - dbDependentPages.length;

  console.log("=== Civica cache consistency validation (PLT-014) ===\n");
  console.log(
    `API methods: ${diskMethodKeys.length} repository-owned; ${ROUTE_FRESHNESS_POLICY.length} declared`,
  );
  console.log(`Export modules: ${exportModules.length} discovered and declared`);
  console.log(
    `DB query functions: ${queryFunctions.length} across ${queryModules.length} module(s); persistent caching forbidden`,
  );
  console.log(
    `Page surfaces: ${pageObservations.length}; ${dbDependentPages.length} DB-dependent; ${buildOnlyPages} build-only`,
  );
  console.log(`Mutable DB roots: ${[...dbRoots].sort().join(", ")}`);

  const uniqueErrors = [...new Set(errors)].sort();
  if (uniqueErrors.length > 0) {
    console.error(`\nFAILED — ${uniqueErrors.length} cache consistency problem(s):\n`);
    for (const error of uniqueErrors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    "\nPASS — API methods, exports, DB queries, and page freshness are closed over one cache contract.",
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
