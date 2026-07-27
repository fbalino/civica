import ts from "typescript";

import type { HttpMethod } from "@/lib/api/route-inventory/registry";
import type { RouteIoPolicyEntry } from "./registry";

export function routeMethodKey(filePath: string, method: string): string {
  return `${filePath}#${method}`;
}

export function inventoryRouteMethodKeys(
  inventory: readonly {
    filePath: string;
    methods: readonly HttpMethod[];
  }[],
): string[] {
  return inventory
    .flatMap((entry) =>
      entry.methods.map((method) => routeMethodKey(entry.filePath, method)),
    )
    .sort();
}

export interface PolicyCoverageReport {
  missing: string[];
  stale: string[];
  duplicates: string[];
}

export function validatePolicyCoverage(
  inventory: readonly {
    filePath: string;
    methods: readonly HttpMethod[];
  }[],
  policy: readonly Pick<RouteIoPolicyEntry, "filePath" | "method">[],
): PolicyCoverageReport {
  const expected = new Set(inventoryRouteMethodKeys(inventory));
  const counts = new Map<string, number>();
  for (const row of policy) {
    const key = routeMethodKey(row.filePath, row.method);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const actual = new Set(counts.keys());
  return {
    missing: [...expected].filter((key) => !actual.has(key)).sort(),
    stale: [...actual].filter((key) => !expected.has(key)).sort(),
    duplicates: [...counts]
      .filter(([, count]) => count > 1)
      .map(([key]) => key)
      .sort(),
  };
}

export function policyDefinitionErrors(
  policy: readonly RouteIoPolicyEntry[],
): string[] {
  const errors: string[] = [];
  for (const row of policy) {
    const key = routeMethodKey(row.filePath, row.method);
    if (!row.request.id.trim())
      errors.push(`${key}: request contract id is blank`);
    if (!row.success.projectionId.trim()) {
      errors.push(`${key}: response projection id is blank`);
    }
    if (row.errors.unknowns !== "fixed-safe-boundary") {
      errors.push(`${key}: unknown failures lack a fixed safe boundary`);
    }
    if (row.errors.cache !== "no-store") {
      errors.push(`${key}: error responses must be no-store`);
    }
    if (row.request.body.kind !== "none") {
      if (
        !Number.isSafeInteger(row.request.body.maxBytes) ||
        row.request.body.maxBytes < 1
      ) {
        errors.push(`${key}: body contract has no positive byte ceiling`);
      }
      if (!row.request.body.schemaId.trim()) {
        errors.push(`${key}: body contract has no schema id`);
      }
    }
    if (
      row.request.querySchemaId !== "none" &&
      (row.request.unknownQuery !== "reject" ||
        row.request.duplicateScalars !== "reject")
    ) {
      errors.push(
        `${key}: query contract is not closed against unknown/duplicate keys`,
      );
    }
    for (const html of row.success.htmlFields) {
      if (!html.path.trim() || !html.sanitizerBoundary.trim()) {
        errors.push(`${key}: HTML field lacks a documented sanitizer boundary`);
      }
    }
  }
  return errors;
}

export type SourceSafetyFindingKind =
  "raw-request-reader" | "response-object-spread" | "raw-error-detail";

export interface SourceSafetyFinding {
  kind: SourceSafetyFindingKind;
  line: number;
  detail: string;
}

function callName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    return `${callName(expression.expression)}.${expression.name.text}`;
  }
  return expression.getText();
}

function isJsonResponseCall(node: ts.CallExpression): boolean {
  const name = callName(node.expression);
  return (
    name === "NextResponse.json" ||
    name === "Response.json" ||
    name === "apiResponse"
  );
}

const APPROVED_RESPONSE_PROJECTIONS: ReadonlyMap<string, string> = new Map([
  ["shapeCountryListItem", "@/lib/api/contract/shapes"],
  ["shapeIndexRankingsItem", "@/lib/api/contract/shapes"],
] as const);

function isApprovedProjectionCall(
  node: ts.Expression,
  source: ts.SourceFile,
): boolean {
  if (!ts.isCallExpression(node)) return false;
  if (!ts.isIdentifier(node.expression)) return false;
  const moduleName = APPROVED_RESPONSE_PROJECTIONS.get(node.expression.text);
  return Boolean(
    moduleName &&
    hasNamedImport(source, node.expression.text, moduleName) &&
    !hasLocalDeclaration(source, node.expression.text),
  );
}

function hasLocalDeclaration(source: ts.SourceFile, name: string): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found || ts.isImportDeclaration(node)) return;
    if (
      ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name?.text === name) ||
      (ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name) ||
      (ts.isParameter(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function hasNamedImport(
  source: ts.SourceFile,
  importedName: string,
  moduleName: string,
): boolean {
  return source.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName
    ) {
      return false;
    }
    const bindings = statement.importClause?.namedBindings;
    return (
      !!bindings &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some(
        (element) =>
          (element.propertyName ?? element.name).text === importedName &&
          element.name.text === importedName,
      )
    );
  });
}

function exportedHandler(
  source: ts.SourceFile,
  method: HttpMethod,
): ts.FunctionDeclaration | undefined {
  return source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === method &&
      !!statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ),
  );
}

type LocalCallable =
  ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;

function localCallables(source: ts.SourceFile): Map<string, LocalCallable> {
  const callables = new Map<string, LocalCallable>();
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

function collectReachableHandlerCalls(
  source: ts.SourceFile,
  method: HttpMethod,
): ts.CallExpression[] | undefined {
  const handler = exportedHandler(source, method);
  if (!handler?.body) return undefined;
  const callables = localCallables(source);
  const visited = new Set<LocalCallable>([handler]);
  const calls: ts.CallExpression[] = [];

  const visitCallable = (callable: LocalCallable) => {
    if (visited.has(callable)) return;
    visited.add(callable);
    if (callable.body) visit(callable.body);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      calls.push(node);
      if (ts.isIdentifier(node.expression)) {
        const local = callables.get(node.expression.text);
        if (local) visitCallable(local);
      } else {
        visit(node.expression);
      }
      for (const argument of node.arguments) {
        if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) {
          visit(argument.body);
        } else if (ts.isIdentifier(argument)) {
          const local = callables.get(argument.text);
          if (local) visitCallable(local);
        } else {
          visit(argument);
        }
      }
      return;
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

  visit(handler.body);
  return calls;
}

/**
 * Proves a named parser import is actually called on a path reachable from the
 * exported handler. Comments, unused imports, dead helper declarations, and
 * same-name local shadows cannot satisfy the proof.
 */
export function handlerInvokesImportedCall(
  sourceText: string,
  method: HttpMethod,
  importedName: string,
  moduleName: string,
  expectedStringArgument?: string,
  fileName = "route.ts",
): boolean {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    !hasNamedImport(source, importedName, moduleName) ||
    hasLocalDeclaration(source, importedName)
  ) {
    return false;
  }
  const calls = collectReachableHandlerCalls(source, method);
  if (!calls) return false;
  return calls.some((node) => {
    if (
      !ts.isIdentifier(node.expression) ||
      node.expression.text !== importedName
    ) {
      return false;
    }
    if (expectedStringArgument === undefined) return true;
    return node.arguments.some((argument) => {
      const value = unwrapExpression(argument);
      return (
        ts.isStringLiteralLike(value) && value.text === expectedStringArgument
      );
    });
  });
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (ts.isParenthesizedExpression(expression)) {
    return unwrapExpression(expression.expression);
  }
  if (ts.isAwaitExpression(expression)) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

/**
 * Requires the exported route handler itself to return the approved boundary.
 * Merely importing or mentioning the helper cannot satisfy this check.
 */
export function handlerReturnsApprovedErrorBoundary(
  sourceText: string,
  method: HttpMethod,
  fileName = "route.ts",
): boolean {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const approvedBoundaryNames = [
    "withSafeJsonErrors",
    "withPrivateSafeJsonErrors",
  ] as const;
  const importedBoundary = approvedBoundaryNames.find(
    (name) =>
      hasNamedImport(source, name, "@/lib/api/problem-response") &&
      !hasLocalDeclaration(source, name),
  );
  if (!importedBoundary) {
    return false;
  }
  const handler = exportedHandler(source, method);
  if (!handler?.body) return false;
  const statement = handler.body.statements[0];
  if (!statement || !ts.isReturnStatement(statement) || !statement.expression) {
    return false;
  }
  const expression = unwrapExpression(statement.expression);
  return (
    ts.isCallExpression(expression) &&
    callName(expression.expression) === importedBoundary
  );
}

export type ErrorProfileFindingKind =
  | "dynamic-error-code"
  | "dynamic-error-copy"
  | "missing-error-code"
  | "missing-error-status"
  | "missing-no-store"
  | "unapproved-problem-helper";

export interface ErrorProfileFinding {
  kind: ErrorProfileFindingKind;
  line: number;
  detail: string;
}

export interface HandlerErrorProfileReport {
  handlerFound: boolean;
  sites: number;
  findings: ErrorProfileFinding[];
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }
  return undefined;
}

function objectProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find(
    (property) =>
      "name" in property &&
      !!property.name &&
      propertyNameText(property.name) === name,
  );
}

function objectHasProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): boolean {
  return objectProperty(object, name) !== undefined;
}

function objectHasLiteralStringProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): boolean {
  const property = objectProperty(object, name);
  if (!property || !ts.isPropertyAssignment(property)) return false;
  return ts.isStringLiteralLike(unwrapExpression(property.initializer));
}

export interface BoundedBodyParserExpectation {
  limitKey: string;
  media: ReadonlyArray<{ mediaType: string; schema: string }>;
}

function importedWithoutShadow(
  source: ts.SourceFile,
  name: string,
  moduleName: string,
): boolean {
  return (
    hasNamedImport(source, name, moduleName) &&
    !hasLocalDeclaration(source, name)
  );
}

/** Exact AST proof for one bounded body-parser contract. */
export function inspectBoundedBodyParserInvocation(
  sourceText: string,
  method: HttpMethod,
  expectation: BoundedBodyParserExpectation,
  fileName = "route.ts",
): string[] {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const findings: string[] = [];
  if (
    !importedWithoutShadow(
      source,
      "parseBoundedRequestBody",
      "@/lib/api/request-body",
    )
  ) {
    findings.push("bounded body parser is not a canonical unshadowed import");
  }
  if (
    !importedWithoutShadow(
      source,
      "REQUEST_BODY_LIMITS",
      "@/lib/api/request-body-schemas",
    )
  ) {
    findings.push("request body limits are not a canonical unshadowed import");
  }
  for (const { mediaType, schema } of expectation.media) {
    if (!importedWithoutShadow(source, mediaType, "@/lib/api/request-body")) {
      findings.push(`${mediaType} is not a canonical unshadowed import`);
    }
    if (
      !importedWithoutShadow(source, schema, "@/lib/api/request-body-schemas")
    ) {
      findings.push(`${schema} is not a canonical unshadowed import`);
    }
  }

  const calls = collectReachableHandlerCalls(source, method);
  if (!calls) return [...findings, "exported handler is missing"];
  const parserCalls = calls.filter(
    (call) =>
      ts.isIdentifier(call.expression) &&
      call.expression.text === "parseBoundedRequestBody",
  );
  if (parserCalls.length !== 1) {
    return [
      ...findings,
      `expected one reachable bounded body parser call, found ${parserCalls.length}`,
    ];
  }

  const options = parserCalls[0].arguments[1];
  const unwrappedOptions = options && unwrapExpression(options);
  if (!unwrappedOptions || !ts.isObjectLiteralExpression(unwrappedOptions)) {
    return [...findings, "body parser options are not an inline object"];
  }
  const maxBytes = objectProperty(unwrappedOptions, "maxBytes");
  if (
    !maxBytes ||
    !ts.isPropertyAssignment(maxBytes) ||
    !ts.isPropertyAccessExpression(unwrapExpression(maxBytes.initializer)) ||
    !ts.isIdentifier(
      (unwrapExpression(maxBytes.initializer) as ts.PropertyAccessExpression)
        .expression,
    ) ||
    (
      unwrapExpression(maxBytes.initializer) as ts.PropertyAccessExpression
    ).expression.getText(source) !== "REQUEST_BODY_LIMITS" ||
    (unwrapExpression(maxBytes.initializer) as ts.PropertyAccessExpression).name
      .text !== expectation.limitKey
  ) {
    findings.push(
      `maxBytes is not REQUEST_BODY_LIMITS.${expectation.limitKey}`,
    );
  }

  const media = objectProperty(unwrappedOptions, "media");
  const mediaValue =
    media && ts.isPropertyAssignment(media)
      ? unwrapExpression(media.initializer)
      : undefined;
  if (!mediaValue || !ts.isArrayLiteralExpression(mediaValue)) {
    return [...findings, "body parser media is not an inline array"];
  }
  if (mediaValue.elements.length !== expectation.media.length) {
    findings.push(
      `expected ${expectation.media.length} media entries, found ${mediaValue.elements.length}`,
    );
  }
  for (const [index, expected] of expectation.media.entries()) {
    const element = mediaValue.elements[index];
    const value = element && unwrapExpression(element);
    if (!value || !ts.isObjectLiteralExpression(value)) {
      findings.push(`media[${index}] is not an inline object`);
      continue;
    }
    if (value.properties.length !== 2) {
      findings.push(`media[${index}] must contain only mediaType and schema`);
    }
    const mediaType = objectProperty(value, "mediaType");
    const schema = objectProperty(value, "schema");
    if (
      !mediaType ||
      !ts.isPropertyAssignment(mediaType) ||
      !ts.isIdentifier(unwrapExpression(mediaType.initializer)) ||
      unwrapExpression(mediaType.initializer).getText(source) !==
        expected.mediaType
    ) {
      findings.push(`media[${index}] does not use ${expected.mediaType}`);
    }
    if (
      !schema ||
      !ts.isPropertyAssignment(schema) ||
      !ts.isIdentifier(unwrapExpression(schema.initializer)) ||
      unwrapExpression(schema.initializer).getText(source) !== expected.schema
    ) {
      findings.push(`media[${index}] does not use ${expected.schema}`);
    }
  }
  return findings;
}

/** Exact AST proof for a query/path parser and its declared schema ID. */
export function inspectSchemaParserInvocation(
  sourceText: string,
  method: HttpMethod,
  parser: "parseQueryContract" | "parsePathContract",
  schemaId: string,
  fileName = "route.ts",
): string[] {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (!importedWithoutShadow(source, parser, "@/lib/api/request-contract")) {
    return [`${parser} is not a canonical unshadowed import`];
  }
  const calls = collectReachableHandlerCalls(source, method);
  if (!calls) return ["exported handler is missing"];
  const parserCalls = calls.filter(
    (call) =>
      ts.isIdentifier(call.expression) && call.expression.text === parser,
  );
  if (parserCalls.length !== 1) {
    return [
      `expected one reachable ${parser} call, found ${parserCalls.length}`,
    ];
  }
  const schemaArgument = parserCalls[0].arguments[1];
  const value = schemaArgument && unwrapExpression(schemaArgument);
  return value && ts.isStringLiteralLike(value) && value.text === schemaId
    ? []
    : [`${parser} does not use the literal schema id ${schemaId}`];
}

/** Exact AST proof for a reachable imported Zod safeParse boundary. */
export function inspectSafeParseInvocation(
  sourceText: string,
  method: HttpMethod,
  schemaName: string,
  fileName = "route.ts",
): string[] {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    !importedWithoutShadow(source, schemaName, "@/lib/api/request-body-schemas")
  ) {
    return [`${schemaName} is not a canonical unshadowed import`];
  }
  const calls = collectReachableHandlerCalls(source, method);
  if (!calls) return ["exported handler is missing"];
  const matches = calls.filter(
    (call) =>
      ts.isPropertyAccessExpression(call.expression) &&
      ts.isIdentifier(call.expression.expression) &&
      call.expression.expression.text === schemaName &&
      call.expression.name.text === "safeParse",
  );
  return matches.length === 1
    ? []
    : [
        `expected one reachable ${schemaName}.safeParse call, found ${matches.length}`,
      ];
}

function hasExplicitErrorStatus(options: ts.Expression | undefined): boolean {
  if (!options || !ts.isObjectLiteralExpression(options)) return false;
  const status = objectProperty(options, "status");
  if (!status || !ts.isPropertyAssignment(status)) return false;
  const initializer = unwrapExpression(status.initializer);
  if (!ts.isNumericLiteral(initializer)) return false;
  const value = Number(initializer.text);
  return value >= 400 && value <= 599;
}

function hasExplicitNoStore(options: ts.Expression | undefined): boolean {
  if (!options || !ts.isObjectLiteralExpression(options)) return false;
  const headers = objectProperty(options, "headers");
  if (!headers || !ts.isPropertyAssignment(headers)) return false;
  const initializer = unwrapExpression(headers.initializer);
  if (!ts.isObjectLiteralExpression(initializer)) return false;
  let noStoreIndex = -1;
  for (const [index, property] of initializer.properties.entries()) {
    if (!("name" in property) || !property.name) continue;
    if (propertyNameText(property.name)?.toLowerCase() !== "cache-control") {
      continue;
    }
    if (!ts.isPropertyAssignment(property)) continue;
    const value = unwrapExpression(property.initializer);
    if (
      ts.isStringLiteralLike(value) &&
      value.text
        .toLowerCase()
        .split(",")
        .some((directive) => directive.trim() === "no-store")
    ) {
      noStoreIndex = index;
    } else {
      noStoreIndex = -1;
    }
  }
  if (noStoreIndex < 0) return false;
  return noStoreIndex === initializer.properties.length - 1;
}

/**
 * Inspects actual error-producing calls inside one exported handler. Calls to
 * the approved `apiProblem` adapter count as stable sites; explicit JSON error
 * bodies must carry both a code and a literal no-store transport policy.
 */
export function inspectHandlerErrorProfiles(
  sourceText: string,
  method: HttpMethod,
  fileName = "route.ts",
): HandlerErrorProfileReport {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const handler = exportedHandler(source, method);
  if (!handler?.body) {
    return { handlerFound: false, sites: 0, findings: [] };
  }

  const approvedProblemImport =
    hasNamedImport(source, "apiProblem", "@/lib/api/problem-response") &&
    !hasLocalDeclaration(source, "apiProblem");
  const findings: ErrorProfileFinding[] = [];
  let sites = 0;
  const objectBindings = new Map<string, ts.ObjectLiteralExpression>();
  const collectBindings = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (ts.isObjectLiteralExpression(initializer)) {
        objectBindings.set(node.name.text, initializer);
      }
    }
    ts.forEachChild(node, collectBindings);
  };
  collectBindings(handler.body);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = callName(node.expression);
      if (name === "apiProblem") {
        sites += 1;
        if (!approvedProblemImport) {
          findings.push({
            kind: "unapproved-problem-helper",
            line: lineOf(source, node),
            detail: "apiProblem call is not imported from the approved adapter",
          });
        }
      } else if (isJsonResponseCall(node)) {
        const rawPayload = node.arguments[0];
        const payload =
          rawPayload && ts.isIdentifier(rawPayload)
            ? objectBindings.get(rawPayload.text)
            : rawPayload;
        if (
          payload &&
          ts.isObjectLiteralExpression(payload) &&
          (objectHasProperty(payload, "error") ||
            objectHasProperty(payload, "errors"))
        ) {
          sites += 1;
          if (!objectHasProperty(payload, "code")) {
            findings.push({
              kind: "missing-error-code",
              line: lineOf(source, node),
              detail: "explicit JSON error body lacks a stable code",
            });
          } else if (!objectHasLiteralStringProperty(payload, "code")) {
            findings.push({
              kind: "dynamic-error-code",
              line: lineOf(source, node),
              detail: "explicit JSON error code is not a fixed literal",
            });
          }
          if (
            objectHasProperty(payload, "error") &&
            !objectHasLiteralStringProperty(payload, "error")
          ) {
            findings.push({
              kind: "dynamic-error-copy",
              line: lineOf(source, node),
              detail: "explicit JSON error copy is not a fixed literal",
            });
          }
          const options = node.arguments[1];
          if (!hasExplicitErrorStatus(options)) {
            findings.push({
              kind: "missing-error-status",
              line: lineOf(source, node),
              detail: "explicit JSON error body lacks a literal 4xx/5xx status",
            });
          }
          if (!hasExplicitNoStore(options)) {
            findings.push({
              kind: "missing-no-store",
              line: lineOf(source, node),
              detail:
                "explicit JSON error body lacks a literal no-store header",
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(handler.body);
  return { handlerFound: true, sites, findings };
}

function containsRawErrorDetail(
  node: ts.Node,
  caughtNames: ReadonlySet<string>,
): boolean {
  let found = false;
  const visit = (child: ts.Node) => {
    if (
      ts.isPropertyAssignment(child) &&
      ((ts.isIdentifier(child.name) && child.name.text === "error") ||
        (ts.isStringLiteral(child.name) && child.name.text === "error")) &&
      ts.isIdentifier(child.initializer)
    ) {
      // A bare alias such as `{ error: message }` hides whether the value was
      // derived from `error.message`. Public errors must be literals or pass
      // through a fixed problem adapter, so reject the ambiguous seam.
      found = true;
      return;
    }
    if (
      ts.isPropertyAccessExpression(child) &&
      ts.isIdentifier(child.expression) &&
      caughtNames.has(child.expression.text) &&
      (child.name.text === "message" || child.name.text === "stack")
    ) {
      found = true;
      return;
    }
    if (
      ts.isElementAccessExpression(child) &&
      child.argumentExpression &&
      ts.isIdentifier(child.expression) &&
      caughtNames.has(child.expression.text) &&
      ts.isStringLiteralLike(child.argumentExpression) &&
      /^(?:message|stack)$/.test(child.argumentExpression.text)
    ) {
      found = true;
      return;
    }
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === "String" &&
      child.arguments.some(
        (arg) => ts.isIdentifier(arg) && caughtNames.has(arg.text),
      )
    ) {
      found = true;
      return;
    }
    if (
      ts.isCallExpression(child) &&
      ts.isPropertyAccessExpression(child.expression) &&
      child.expression.name.text === "toString" &&
      ts.isIdentifier(child.expression.expression) &&
      caughtNames.has(child.expression.expression.text)
    ) {
      found = true;
      return;
    }
    if (
      ts.isTemplateExpression(child) &&
      child.templateSpans.some(
        (span) =>
          ts.isIdentifier(span.expression) &&
          caughtNames.has(span.expression.text),
      )
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/**
 * AST checks for the three high-risk route-source patterns PLT-012 closes.
 * This intentionally does not ban ordinary object spread: only spread that
 * reaches a JSON serializer without first passing through a registered
 * strict projection call is rejected.
 */
export function scanRouteSourceSafety(
  sourceText: string,
  fileName = "route.ts",
): SourceSafetyFinding[] {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const findings: SourceSafetyFinding[] = [];
  const requestAliases = new Set(["request", "req"]);
  const caughtNames = new Set<string>();
  const collectBoundaryNames = (node: ts.Node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(node.name.text)
    ) {
      const parameter = node.parameters[0];
      if (parameter && ts.isIdentifier(parameter.name)) {
        requestAliases.add(parameter.name.text);
      }
    }
    if (
      ts.isCatchClause(node) &&
      node.variableDeclaration &&
      ts.isIdentifier(node.variableDeclaration.name)
    ) {
      caughtNames.add(node.variableDeclaration.name.text);
    }
    ts.forEachChild(node, collectBoundaryNames);
  };
  collectBoundaryNames(source);
  let discoveredAlias = true;
  while (discoveredAlias) {
    discoveredAlias = false;
    const collectAliases = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        requestAliases.has(node.initializer.text) &&
        !requestAliases.has(node.name.text)
      ) {
        requestAliases.add(node.name.text);
        discoveredAlias = true;
      }
      ts.forEachChild(node, collectAliases);
    };
    collectAliases(source);
  }

  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      requestAliases.has(node.expression.text) &&
      /^(?:json|formData|text)$/.test(node.name.text)
    ) {
      findings.push({
        kind: "raw-request-reader",
        line: lineOf(source, node),
        detail: `${node.getText(source)} bypasses the bounded request-contract parser`,
      });
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      requestAliases.has(node.expression.text) &&
      node.argumentExpression &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      /^(?:json|formData|text)$/.test(node.argumentExpression.text)
    ) {
      findings.push({
        kind: "raw-request-reader",
        line: lineOf(source, node),
        detail: `${node.getText(source)} bypasses the bounded request-contract parser`,
      });
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      requestAliases.has(node.initializer.text) &&
      node.name.elements.some((element) => {
        const name = element.propertyName ?? element.name;
        return (
          ts.isIdentifier(name) && /^(?:json|formData|text)$/.test(name.text)
        );
      })
    ) {
      findings.push({
        kind: "raw-request-reader",
        line: lineOf(source, node),
        detail: `${node.getText(source)} aliases a raw request reader`,
      });
    }
    if (ts.isCallExpression(node)) {
      if (isJsonResponseCall(node) && node.arguments[0]) {
        const payload = node.arguments[0];
        if (!isApprovedProjectionCall(payload, source)) {
          const inspect = (child: ts.Node) => {
            // A nested value has crossed the same strict projection seam as a
            // top-level payload (for example `data.map(row =>
            // shapeCountryListItem({ ...row }))`). Do not inspect inside it;
            // the schema parser rejects unknown fields before serialization.
            if (
              ts.isCallExpression(child) &&
              isApprovedProjectionCall(child, source)
            ) {
              return;
            }
            if (ts.isSpreadAssignment(child)) {
              findings.push({
                kind: "response-object-spread",
                line: lineOf(source, child),
                detail:
                  "object spread reaches JSON serialization without a strict projection adapter",
              });
            }
            ts.forEachChild(child, inspect);
          };
          inspect(payload);
        }
        if (containsRawErrorDetail(payload, caughtNames)) {
          findings.push({
            kind: "raw-error-detail",
            line: lineOf(source, payload),
            detail: "unknown exception detail reaches a response payload",
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

export function methodFromKey(key: string): HttpMethod {
  return key.slice(key.lastIndexOf("#") + 1) as HttpMethod;
}
