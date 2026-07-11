import ts from "typescript";

/**
 * CLM-006 guards mutable *public coverage/count claims*, not every number in
 * the repository. Dates, scores, constitutional facts, CSS values, API
 * payload fields, and implementation constants are deliberately outside this
 * audit unless they are part of a sentence that describes how much Civica (or
 * one of its public datasets) currently covers.
 *
 * Discovery is intentionally conservative:
 *
 * - runtime `{{stats.*}}` counters are always in scope;
 * - state/ctx/JS expressions are in scope when paired with a count noun;
 * - literal counts need both a count noun and public-coverage language; and
 * - blog literals additionally need Civica/product context, so third-party
 *   historical facts are not mistaken for Civica coverage claims.
 *
 * A discovered claim must have one registry row. Runtime rows point to a
 * generated value, frozen rows point to a visibly dated/released snapshot,
 * and exempt rows are limited to copy that visibly labels a limit, target, or
 * illustrative example. Registration is not a way to waive a stale live
 * literal: disposition checks still fail it.
 */

export const PUBLIC_NUMERIC_CLAIM_DISPOSITIONS = [
  "runtime",
  "frozen",
  "exempt",
] as const;

export type PublicNumericClaimDisposition =
  (typeof PUBLIC_NUMERIC_CLAIM_DISPOSITIONS)[number];

export interface PublicNumericClaimRegistration {
  id: string;
  /** Repository-relative source-of-truth file (README.md is derivative). */
  file: string;
  /** Public route, artifact, or component surface. */
  surface: string;
  /** Exact public substring or template marker used to bind this row. */
  fragment: string;
  disposition: PublicNumericClaimDisposition;
  /** Runtime producer, frozen dataset/release, or exemption rationale. */
  source: string;
  /** Required for frozen rows unless `release` is supplied. */
  asOf?: string;
  /** Required for frozen rows unless `asOf` is supplied. */
  release?: string;
}

export interface PublicNumericDocument {
  file: string;
  surface: string;
  source: string;
  kind: "markdown" | "typescript";
}

export interface PublicNumericTextFragment {
  file: string;
  surface: string;
  fragment: string;
  line: number;
}

export interface PublicNumericClaimCandidate extends PublicNumericTextFragment {
  hasRuntimeValue: boolean;
  hasLiteralCount: boolean;
  hasCurrentLiteralCount: boolean;
  hasVisibleFreeze: boolean;
  hasVisibleExemption: boolean;
}

export type PublicNumericClaimAuditCode =
  | "duplicate-registry-id"
  | "invalid-registry-row"
  | "missing-stats-fallback"
  | "unregistered-claim"
  | "orphan-registry-entry"
  | "disposition-mismatch"
  | "ambiguous-registration";

export interface PublicNumericClaimAuditError {
  code: PublicNumericClaimAuditCode;
  message: string;
  file?: string;
  line?: number;
  id?: string;
}

export interface PublicNumericClaimAuditResult {
  candidates: PublicNumericClaimCandidate[];
  errors: PublicNumericClaimAuditError[];
}

export interface StatsMarkerWithoutFallback {
  marker: string;
  path: string;
  line: number;
}

const TEMPLATE_MARKER = /\{\{([^{}]+?)\}\}/g;
const JS_COUNT_NAME =
  "(?:count|length|size|total|number|scored|dimension|categor|sources?|rows?|jurisdictions?|countries|entries|events?)";
const RUNTIME_MARKER = new RegExp(
  `\\{\\{\\s*(?:stats|state|ctx)\\.[^{}]+\\}\\}|\\$\\{[^{}]*${JS_COUNT_NAME}[^{}]*\\}|\\{[^{}]*${JS_COUNT_NAME}[^{}]*\\}`,
  "i",
);
const STATS_PATH = /^stats\.[A-Za-z_][\w.]*/;

const COUNT_NOUN =
  "(?:countries(?:\\s+and\\s+territories)?|territories|jurisdictions|" +
  "sources|publishers|orchestrators|facts|fact[-\\s]?keys|rows|records|" +
  "entries|observations|indicators|dimensions|categories|datasets|" +
  "elections|events|constitutions|chambers|profiles|metrics|offices|syncs)";
// The negative lookbehind keeps version/classification labels such as Tier-1,
// ISO3, v2, and EU-27 out of the count grammar.
const LITERAL_COUNT =
  "(?<![A-Za-z0-9_.-])(?:~\\s*)?\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?\\+?";
const DYNAMIC_COUNT = `(?:\\{\\{\\s*(?:stats|state|ctx)\\.[^{}]+\\}\\}|\\$\\{[^{}]*${JS_COUNT_NAME}[^{}]*\\}|\\{[^{}]*${JS_COUNT_NAME}[^{}]*\\})`;
const ANY_COUNT = `(?:${LITERAL_COUNT}|${DYNAMIC_COUNT})`;
const COUNT_BEFORE_NOUN = new RegExp(
  `${ANY_COUNT}\\s+(?:[A-Za-z][\\w-]*\\s+){0,2}${COUNT_NOUN}\\b`,
  "i",
);
const LITERAL_COUNT_BEFORE_NOUN = new RegExp(
  `${LITERAL_COUNT}\\s+(?:[A-Za-z][\\w-]*\\s+){0,2}${COUNT_NOUN}\\b`,
  "i",
);
const TABLE_COUNT = new RegExp(
  `${COUNT_NOUN}(?:\\s+(?:covered|coverage|total|count))?\\s*\\|\\s*${ANY_COUNT}`,
  "i",
);
const TABLE_LITERAL_COUNT = new RegExp(
  `${COUNT_NOUN}(?:\\s+(?:covered|coverage|total|count))?\\s*\\|\\s*${LITERAL_COUNT}`,
  "i",
);

const COVERAGE_LANGUAGE =
  /\b(?:active|all|atlas|available|civica|complete|currently|coverage|covers?|covered|covering|database|dataset|full|holds?|ingested|integrates?|live|rankings?|scope|scored|ships?|sort|sources? writing|total)\b/i;
const CIVICA_CONTEXT =
  /\b(?:Civica|Civica Atlas|the atlas|our (?:data|database|dataset|coverage)|global rankings|country profiles?)\b/i;
const CURRENT_CLAIM_LANGUAGE =
  /\b(?:current|currently|live|today|now|covers?|holds?|integrates?|catalogues?|ships?|indexes?|tracks?|reports?)\b/i;
const VISIBLE_EXEMPTION =
  /\b(?:illustrative(?: example)?|example (?:response|only)|sample|hypothetical|target|planned|planning|up to|maximum|minimum|at (?:least|most)|limit(?:ed)? to|threshold)\b/i;
const QUALIFIED_LITERAL_EXEMPTION = new RegExp(
  `${VISIBLE_EXEMPTION.source}[^\\n.!?]{0,160}${LITERAL_COUNT}\\s+(?:[A-Za-z][\\w-]*\\s+){0,2}${COUNT_NOUN}\\b`,
  "i",
);
const VISIBLE_FREEZE = new RegExp(
  [
    "(?:as\\s+(?:of|at)|snapshot|vintage|release|edition|report|frozen|cut\\s+on|dated)",
    "[^\\n]{0,100}",
    "(?:19|20)\\d{2}(?:[- ]?Q[1-4]|-\\d{2}(?:-\\d{2})?)?",
  ].join(""),
  "i",
);
const REVERSE_VISIBLE_FREEZE =
  /\b(?:19|20)\d{2}(?:[- ]?Q[1-4]|-\d{2}(?:-\d{2})?)?[^\n]{0,40}\b(?:report|release|edition|snapshot|vintage)\b/i;
const DYNAMIC_VISIBLE_FREEZE =
  /\b(?:as of|data vintage|snapshot|vintage|release|run)\b[^\n]{0,100}(?:\{\{\s*(?:state|ctx)\.[^{}]*(?:date|vintage|release)[^{}]*\}\}|\$?\{[^{}]*(?:date|vintage|release)[^{}]*\})/i;
const STATE_VINTAGE_MARKER =
  /\{\{\s*state\.[^{}]*(?:dataVintage|snapshot|release)[^{}]*\}\}/i;
const ILLUSTRATIVE_PAYLOAD_COUNT = /"(?:total|count)"\s*:\s*\d[\d,]*/i;

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

export function normalizeNumericClaimFragment(value: string): string {
  return value
    .replace(/&(?:nbsp|mdash|ndash);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Find `{{stats.*}}` markers that cannot soft-fail when the DB is down. */
export function findStatsMarkersWithoutFallback(
  source: string,
): StatsMarkerWithoutFallback[] {
  const failures: StatsMarkerWithoutFallback[] = [];
  let match: RegExpExecArray | null;
  TEMPLATE_MARKER.lastIndex = 0;

  while ((match = TEMPLATE_MARKER.exec(source)) !== null) {
    const body = match[1].trim();
    const pathMatch = body.match(STATS_PATH);
    if (!pathMatch) continue;

    // The substitution grammar accepts only a quoted fallback. Merely
    // containing a pipe is insufficient (`{{stats.x | fallback}}` is broken).
    const fallbackMatch = body.match(
      /^stats\.[A-Za-z_][\w.]*\s*\|\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*$/,
    );
    if (fallbackMatch) continue;

    failures.push({
      marker: match[0],
      path: pathMatch[0],
      line: lineOf(source, match.index),
    });
  }

  return failures;
}

function blankPreservingNewlines(value: string): string {
  return value.replace(/[^\n]/g, " ");
}

function stripMarkdownNonRenderedText(source: string): string {
  // Preserve newlines so reported source locations stay useful. Fenced code is
  // rendered public content and remains in scope; only authoring comments are
  // non-rendered.
  return source.replace(/<!--[\s\S]*?-->/g, blankPreservingNewlines);
}

function markdownFragments(
  document: PublicNumericDocument,
): PublicNumericTextFragment[] {
  const rendered = stripMarkdownNonRenderedText(document.source);
  const fragments: PublicNumericTextFragment[] = [];
  let offset = 0;

  for (const line of rendered.split("\n")) {
    const fragment = normalizeNumericClaimFragment(line);
    if (fragment) {
      fragments.push({
        file: document.file,
        surface: document.surface,
        fragment,
        line: lineOf(rendered, offset),
      });
    }
    offset += line.length + 1;
  }

  return fragments;
}

function renderTemplateExpression(
  node: ts.TemplateExpression,
  sourceFile: ts.SourceFile,
): string {
  let result = node.head.text;
  for (const span of node.templateSpans) {
    result += `\${${span.expression.getText(sourceFile)}}${span.literal.text}`;
  }
  return result;
}

function renderJsxChildren(
  children: ts.NodeArray<ts.JsxChild>,
  sourceFile: ts.SourceFile,
): string {
  let result = "";
  for (const child of children) {
    if (ts.isJsxText(child)) result += child.getText(sourceFile);
    else if (ts.isJsxExpression(child) && child.expression) {
      if (
        ts.isStringLiteral(child.expression) ||
        ts.isNoSubstitutionTemplateLiteral(child.expression)
      ) {
        result += ` ${child.expression.text} `;
      } else if (ts.isTemplateExpression(child.expression)) {
        result += ` ${renderTemplateExpression(child.expression, sourceFile)} `;
      } else {
        const expressionText = child.expression.getText(sourceFile);
        // Keep simple runtime expressions exact. Complex conditionals/maps
        // are visited separately; embedding their entire source in a parent
        // fragment creates duplicate page-sized pseudo-copy.
        const renderedExpression =
          expressionText.length <= 120 && !/[<>]/.test(expressionText)
            ? `{${expressionText}}`
            : "{runtime}";
        result += ` ${renderedExpression} `;
      }
    } else if (ts.isJsxElement(child)) {
      result += ` ${renderJsxChildren(child.children, sourceFile)} `;
    } else if (ts.isJsxSelfClosingElement(child)) {
      result += " ";
    }
  }
  return result;
}

function typescriptFragments(
  document: PublicNumericDocument,
): PublicNumericTextFragment[] {
  const scriptKind = document.file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    document.file,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const fragments: PublicNumericTextFragment[] = [];

  const isInsideJsxAttribute = (node: ts.Node, name: string): boolean => {
    let current: ts.Node | undefined = node.parent;
    for (
      let depth = 0;
      current && depth < 3;
      depth++, current = current.parent
    ) {
      if (
        ts.isJsxAttribute(current) &&
        current.name.getText(sourceFile) === name
      ) {
        return true;
      }
    }
    return false;
  };

  const add = (fragment: string, node: ts.Node): void => {
    const normalized = normalizeNumericClaimFragment(fragment);
    if (!normalized) return;
    fragments.push({
      file: document.file,
      surface: document.surface,
      fragment: normalized,
      line:
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          .line + 1,
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // Module specifiers and property names cannot be public copy.
      if (
        !ts.isImportDeclaration(node.parent) &&
        !ts.isExportDeclaration(node.parent) &&
        !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)
      ) {
        add(
          isInsideJsxAttribute(node, "exampleResponse")
            ? `Illustrative example response: ${node.text}`
            : node.text,
          node,
        );
      }
    } else if (ts.isTemplateExpression(node)) {
      const rendered = renderTemplateExpression(node, sourceFile);
      add(
        isInsideJsxAttribute(node, "exampleResponse")
          ? `Illustrative example response: ${rendered}`
          : rendered,
        node,
      );
    } else if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(sourceFile).toLowerCase();
      const rendered = renderJsxChildren(node.children, sourceFile);
      if (
        /^(?:p|h[1-6]|li|dt|dd|th|td|caption|blockquote|span|strong|em|label)$/.test(
          tag,
        )
      ) {
        add(rendered, node);
      } else if (
        tag === "div" &&
        normalizeNumericClaimFragment(rendered).length <= 300 &&
        !node.children.some(
          (child) =>
            ts.isJsxElement(child) &&
            !/^(?:span|small|strong|em)$/.test(
              child.openingElement.tagName.getText(sourceFile).toLowerCase(),
            ),
        )
      ) {
        // Small metric/stat wrappers often split the runtime value and its
        // count label across sibling spans. Page/layout divs are intentionally
        // ignored to avoid page-sized duplicate pseudo-fragments.
        add(rendered, node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return fragments;
}

export function extractPublicNumericTextFragments(
  document: PublicNumericDocument,
): PublicNumericTextFragment[] {
  const fragments =
    document.kind === "markdown"
      ? markdownFragments(document)
      : typescriptFragments(document);
  const seen = new Set<string>();

  return fragments.filter((fragment) => {
    const key = `${fragment.file}\0${fragment.fragment}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasCountShape(fragment: string): boolean {
  return COUNT_BEFORE_NOUN.test(fragment) || TABLE_COUNT.test(fragment);
}

function isBlogFile(file: string): boolean {
  return file.startsWith("content/blog/");
}

function isClaimCandidate(
  fragment: PublicNumericTextFragment,
  nearbyText: string,
  documentSource: string,
): boolean {
  const text = fragment.fragment;
  if (
    (fragment.file === "src/app/api-docs/page.tsx" ||
      fragment.file === "src/lib/api/contract/examples.ts") &&
    /Illustrative Example Response/i.test(documentSource) &&
    ILLUSTRATIVE_PAYLOAD_COUNT.test(text)
  ) {
    return true;
  }
  if (/\{\{\s*stats\./i.test(text)) return true;
  if (!hasCountShape(text)) return false;

  const hasRuntime = RUNTIME_MARKER.test(text);
  if (hasRuntime) return true;

  if (isBlogFile(fragment.file)) {
    return CIVICA_CONTEXT.test(`${nearbyText} ${text}`);
  }

  if (fragment.file === "README.template.md") return true;

  return COVERAGE_LANGUAGE.test(text);
}

export function discoverPublicNumericClaimCandidates(
  documents: readonly PublicNumericDocument[],
): PublicNumericClaimCandidate[] {
  const candidates: PublicNumericClaimCandidate[] = [];

  for (const document of documents) {
    const fragments = extractPublicNumericTextFragments(document);
    for (const [index, fragment] of fragments.entries()) {
      // Markdown bullets often inherit “Using Civica data…” from the preceding
      // paragraph. A two-fragment window catches that without making the whole
      // article product-contextual.
      const nearbyText = fragments
        .slice(Math.max(0, index - 2), index)
        .map((entry) => entry.fragment)
        .join(" ");
      if (!isClaimCandidate(fragment, nearbyText, document.source)) continue;
      const hasLiteralCount =
        LITERAL_COUNT_BEFORE_NOUN.test(fragment.fragment) ||
        TABLE_LITERAL_COUNT.test(fragment.fragment);
      const generatedApiExampleIsVisiblyIllustrative =
        fragment.file === "src/lib/api/contract/examples.ts" &&
        /Illustrative Example Response/i.test(document.source);
      const literalExemptionIsBound =
        !hasLiteralCount ||
        generatedApiExampleIsVisiblyIllustrative ||
        QUALIFIED_LITERAL_EXEMPTION.test(fragment.fragment);

      candidates.push({
        ...fragment,
        hasRuntimeValue: RUNTIME_MARKER.test(fragment.fragment),
        hasLiteralCount,
        hasCurrentLiteralCount:
          hasLiteralCount && CURRENT_CLAIM_LANGUAGE.test(fragment.fragment),
        hasVisibleFreeze:
          VISIBLE_FREEZE.test(fragment.fragment) ||
          REVERSE_VISIBLE_FREEZE.test(fragment.fragment) ||
          DYNAMIC_VISIBLE_FREEZE.test(fragment.fragment) ||
          STATE_VINTAGE_MARKER.test(fragment.fragment),
        hasVisibleExemption:
          (generatedApiExampleIsVisiblyIllustrative ||
            VISIBLE_EXEMPTION.test(fragment.fragment)) &&
          literalExemptionIsBound,
      });
    }
  }

  return candidates;
}

function registrationMatchesCandidate(
  registration: PublicNumericClaimRegistration,
  candidate: PublicNumericClaimCandidate,
): boolean {
  return (
    registration.file === candidate.file &&
    registration.surface === candidate.surface &&
    normalizeNumericClaimFragment(candidate.fragment).includes(
      normalizeNumericClaimFragment(registration.fragment),
    )
  );
}

function validateRegistration(
  registration: PublicNumericClaimRegistration,
): string[] {
  const errors: string[] = [];
  if (!registration.id.trim()) errors.push("id is required");
  if (!registration.file.trim()) errors.push("file is required");
  if (!registration.surface.trim()) errors.push("surface is required");
  if (!registration.fragment.trim()) errors.push("fragment is required");
  if (!registration.source.trim()) errors.push("source is required");
  if (!PUBLIC_NUMERIC_CLAIM_DISPOSITIONS.includes(registration.disposition)) {
    errors.push(`unknown disposition ${String(registration.disposition)}`);
  }
  if (
    registration.disposition === "frozen" &&
    !registration.asOf?.trim() &&
    !registration.release?.trim()
  ) {
    errors.push("frozen rows require asOf or release");
  }
  return errors;
}

export function auditPublicNumericClaims(
  documents: readonly PublicNumericDocument[],
  registry: readonly PublicNumericClaimRegistration[],
): PublicNumericClaimAuditResult {
  const errors: PublicNumericClaimAuditError[] = [];
  const ids = new Set<string>();

  for (const registration of registry) {
    if (ids.has(registration.id)) {
      errors.push({
        code: "duplicate-registry-id",
        id: registration.id,
        file: registration.file,
        message: `${registration.id}: duplicate numeric-claim registry id`,
      });
    }
    ids.add(registration.id);
    for (const error of validateRegistration(registration)) {
      errors.push({
        code: "invalid-registry-row",
        id: registration.id,
        file: registration.file,
        message: `${registration.id}: ${error}`,
      });
    }
  }

  for (const document of documents) {
    const renderedSource =
      document.kind === "markdown"
        ? stripMarkdownNonRenderedText(document.source)
        : extractPublicNumericTextFragments(document)
            .map((fragment) => fragment.fragment)
            .join("\n");
    for (const missing of findStatsMarkersWithoutFallback(renderedSource)) {
      errors.push({
        code: "missing-stats-fallback",
        file: document.file,
        line: missing.line,
        message: `${document.file}:${missing.line}: ${missing.marker} requires a quoted soft fallback`,
      });
    }
  }

  const candidates = discoverPublicNumericClaimCandidates(documents);
  const matchedRegistryIds = new Set<string>();

  for (const candidate of candidates) {
    const matches = registry.filter((registration) =>
      registrationMatchesCandidate(registration, candidate),
    );
    if (matches.length === 0) {
      errors.push({
        code: "unregistered-claim",
        file: candidate.file,
        line: candidate.line,
        message: `${candidate.file}:${candidate.line}: unregistered mutable public coverage/count claim — ${JSON.stringify(candidate.fragment)}`,
      });
      continue;
    }
    if (matches.length > 1) {
      errors.push({
        code: "ambiguous-registration",
        file: candidate.file,
        line: candidate.line,
        message: `${candidate.file}:${candidate.line}: numeric claim matches multiple registry rows (${matches.map((match) => match.id).join(", ")})`,
      });
      continue;
    }

    const [registration] = matches;
    matchedRegistryIds.add(registration.id);
    const validDisposition =
      (registration.disposition === "runtime" &&
        candidate.hasRuntimeValue &&
        !candidate.hasLiteralCount) ||
      (registration.disposition === "frozen" &&
        candidate.hasVisibleFreeze &&
        !candidate.hasCurrentLiteralCount) ||
      (registration.disposition === "exempt" &&
        candidate.hasVisibleExemption &&
        !candidate.hasCurrentLiteralCount);
    if (!validDisposition) {
      errors.push({
        code: "disposition-mismatch",
        file: candidate.file,
        line: candidate.line,
        id: registration.id,
        message: `${registration.id}: ${registration.disposition} disposition is not visibly supported by ${candidate.file}:${candidate.line}`,
      });
    }
  }

  for (const registration of registry) {
    if (!matchedRegistryIds.has(registration.id)) {
      errors.push({
        code: "orphan-registry-entry",
        file: registration.file,
        id: registration.id,
        message: `${registration.id}: registry fragment no longer matches a discovered claim in ${registration.file}`,
      });
    }
  }

  return { candidates, errors };
}

/**
 * Registry source of truth. Rows are deliberately explicit rather than a
 * general allowlist: removing or rewriting the bound public fragment makes the
 * validator report an orphan.
 */
function runtimeClaim(
  id: string,
  file: string,
  surface: string,
  fragment: string,
  source: string,
): PublicNumericClaimRegistration {
  return { id, file, surface, fragment, disposition: "runtime", source };
}

function exemptClaim(
  id: string,
  file: string,
  surface: string,
  fragment: string,
  source: string,
): PublicNumericClaimRegistration {
  return { id, file, surface, fragment, disposition: "exempt", source };
}

export const PUBLIC_NUMERIC_CLAIMS: readonly PublicNumericClaimRegistration[] =
  [
    runtimeClaim(
      "readme.reconciliation-summary",
      "README.template.md",
      "README",
      '{{stats.activeSources | "multiple"}} active source orchestrators',
      "getSiteStats plus regenerate-readme state/ctx helpers, with generic fallbacks",
    ),
    runtimeClaim(
      "readme.status-active-sources",
      "README.template.md",
      "README",
      '{{stats.activeSources | "Multiple"}} (',
      "getSiteStats().activeSources with a generic fallback",
    ),
    runtimeClaim(
      "readme.status-fact-rows",
      "README.template.md",
      "README",
      '{{ctx.totalFactsRoundedThousands | "Many"}} across',
      "regenerate-readme ctx derived from getSiteStats().totalFacts",
    ),
    runtimeClaim(
      "readme.status-multisourced-keys",
      "README.template.md",
      "README",
      '{{stats.multiSourcedFactKeys | "Multiple"}}',
      "getSiteStats().multiSourcedFactKeys with a generic fallback",
    ),
    runtimeClaim(
      "readme.status-five-source-keys",
      "README.template.md",
      "README",
      '{{stats.fiveSourceFactKeys | "Several"}}',
      "getSiteStats().fiveSourceFactKeys with a generic fallback",
    ),
    runtimeClaim(
      "data-approach.active-sources",
      "content/data-approach.md",
      "reader:data-approach",
      '{{stats.activeSources | "multiple"}} source orchestrators',
      "getSiteStats().activeSources with a generic fallback",
    ),
    runtimeClaim(
      "data-approach.single-source-coverage",
      "content/data-approach.md",
      "reader:data-approach",
      '{{stats.singleSourcedFactKeys | "Many"}} of {{stats.distinctFactKeys | "many"}}',
      "getSiteStats single-sourced and distinct fact-key counts with generic fallbacks",
    ),
    runtimeClaim(
      "provenance-report.scope",
      "src/app/(reader)/methodology/provenance-coverage/page.tsx",
      "/methodology/provenance-coverage",
      "It covers {number.format(report.facts.distinctJurisdictions)} country or area records",
      "checked fact-coverage.generated.json produced from the live database",
    ),
    runtimeClaim(
      "provenance-report.statement-coverage",
      "src/app/(reader)/methodology/provenance-coverage/page.tsx",
      "/methodology/provenance-coverage",
      "Total: {number.format(report.statements.sourceLinked)} of {number.format(report.statements.total)} statement rows",
      "checked fact-coverage.generated.json produced from the live database",
    ),
    runtimeClaim(
      "domain-source-coverage.rows",
      "src/app/(reader)/methodology/source-coverage/page.tsx",
      "/methodology/source-coverage",
      "{number.format(domain.recordCount)} {domain.recordLabel}",
      "checked domain-coverage.generated.json produced from the live database",
    ),
    runtimeClaim(
      "index-methodology.pca-headline",
      "content/methodology-civica-index.md",
      "reader:methodology-civica-index",
      "{{state.civicaIndex.dimensionCount}} dimensions are highly correlated",
      "registered site-state Civica Index PCA configuration",
    ),
    runtimeClaim(
      "index-methodology.complete-estimate",
      "content/methodology-civica-index.md",
      "reader:methodology-civica-index",
      "All {{state.civicaIndex.dimensionCount}} dimensions present",
      "site-state.civicaIndex.dimensionCount",
    ),
    runtimeClaim(
      "index-methodology.publication-threshold",
      "content/methodology-civica-index.md",
      "reader:methodology-civica-index",
      "at least {{state.civicaIndex.missingness.minimumDimensionsForPublication}} of the {{state.civicaIndex.dimensionCount}} dimensions",
      "versioned site-state Civica Index missingness policy",
    ),
    runtimeClaim(
      "index-methodology.uncertainty-coverage",
      "content/methodology-civica-index.md",
      "reader:methodology-civica-index",
      "usable uncertainty coverage is {{state.civicaIndex.uncertainty.usableReleasedUncertaintyRows}} of {{state.civicaIndex.uncertainty.releasedDimensionRows}} rows",
      "checked current-release uncertainty audit exposed through site-state.civicaIndex.uncertainty",
    ),
    runtimeClaim(
      "pca-appendix.panel-summary",
      "content/methodology-pca-appendix.md",
      "reader:methodology-pca-appendix",
      "{{state.civicaIndex.pca.panelSize}} countries** with all",
      "registered site-state Civica Index PCA panel, dimensions, and data vintage",
    ),
    runtimeClaim(
      "pca-appendix.dimension-limitation",
      "content/methodology-pca-appendix.md",
      "reader:methodology-pca-appendix",
      "describe these {{state.civicaIndex.pca.panelSize}} observations only",
      "site-state.civicaIndex PCA panel size",
    ),
    runtimeClaim(
      "pca-appendix.sample-size",
      "content/methodology-pca-appendix.md",
      "reader:methodology-pca-appendix",
      "contains {{state.civicaIndex.pca.panelSize}} countries from one 2023 cross-section",
      "registered site-state Civica Index PCA panel and data vintage",
    ),
    runtimeClaim(
      "pca-appendix.source-coverage",
      "content/methodology-pca-appendix.md",
      "reader:methodology-pca-appendix",
      "{{state.civicaIndex.pca.panelSize}} countries with all",
      "registered site-state Civica Index PCA panel and dimension count",
    ),
    runtimeClaim(
      "peer-grouping.vdem-dependency",
      "content/methodology-peer-grouping.md",
      "reader:methodology-peer-grouping",
      "two of its {{state.civicaIndex.dimensionCount}} dimensions",
      "site-state.civicaIndex.dimensionCount and declared V-Dem input mapping",
    ),
    runtimeClaim(
      "pulse-methodology.taxonomy-total",
      "content/methodology-pulse.md",
      "reader:methodology-pulse",
      "{{ctx.ontologyCategoryCount}} event categories",
      "registered pulse-event-ontology/v3.0 codebook",
    ),
    runtimeClaim(
      "pulse-methodology.democratic-quality-categories",
      "content/methodology-pulse.md",
      "reader:methodology-pulse",
      "{{state.pulse.taxonomy.categoriesPerDimension.democratic_quality}} categories",
      "registered site-state Pulse taxonomy",
    ),
    runtimeClaim(
      "pulse-methodology.rule-of-law-categories",
      "content/methodology-pulse.md",
      "reader:methodology-pulse",
      "{{state.pulse.taxonomy.categoriesPerDimension.rule_of_law}} categories",
      "registered site-state Pulse taxonomy",
    ),
    runtimeClaim(
      "pulse-methodology.freedom-rights-categories",
      "content/methodology-pulse.md",
      "reader:methodology-pulse",
      "{{state.pulse.taxonomy.categoriesPerDimension.freedom_rights}} categories",
      "registered site-state Pulse taxonomy",
    ),
    runtimeClaim(
      "pulse-methodology.corruption-control-categories",
      "content/methodology-pulse.md",
      "reader:methodology-pulse",
      "{{state.pulse.taxonomy.categoriesPerDimension.corruption_control}} categories",
      "registered site-state Pulse taxonomy",
    ),
    runtimeClaim(
      "pulse-methodology.stability-categories",
      "content/methodology-pulse.md",
      "reader:methodology-pulse",
      "{{state.pulse.taxonomy.categoriesPerDimension.stability}} categories",
      "registered site-state Pulse taxonomy",
    ),
    runtimeClaim(
      "pulse-methodology.source-retained-rows",
      "src/app/(reader)/civica-index/methodology/pulse/page.tsx",
      "/civica-index/methodology/pulse",
      "${feed.evidence.retainedRows} rows; latest ${utcMinute(feed.evidence.lastDataAt)}",
      "live pulse-source-coverage/v1 retained-row and latest-data aggregates",
    ),
    runtimeClaim(
      "pulse-methodology.source-jurisdiction-scope",
      "src/app/(reader)/civica-index/methodology/pulse/page.tsx",
      "/civica-index/methodology/pulse",
      "${languages}; ${feed.evidence.observedJurisdictions} resolved jurisdictions; ${feed.evidence.unresolvedJurisdictionRows} unresolved rows",
      "live pulse-source-coverage/v1 resolved and unresolved jurisdiction aggregates",
    ),
    runtimeClaim(
      "index-methodology.visible-dimensions",
      "src/app/(reader)/civica-index/methodology/page.tsx",
      "/civica-index/methodology",
      "{civicaIndex.dimensionCount} governance dimensions",
      "site-state.civicaIndex.dimensionCount",
    ),
    runtimeClaim(
      "pca-page.figure-dimensions",
      "src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx",
      "/civica-index/methodology/pca-appendix",
      "{civicaIndex.dimensionCount}",
      "site-state.civicaIndex dimension and PCA configuration",
    ),
    runtimeClaim(
      "pca-page.panel-size",
      "src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx",
      "/civica-index/methodology/pca-appendix",
      "{pca.panelSize} countries",
      "site-state.civicaIndex.pca.panelSize and lastRunDate",
    ),
    runtimeClaim(
      "reconciliation.metadata-source-roster",
      "src/app/(reader)/country/methodology/reconciliation/page.tsx",
      "/country/methodology/reconciliation",
      "${tier1Shipped.length} multilateral publishers",
      "site-state tier1Publishers and nsoWave1 rosters",
    ),
    runtimeClaim(
      "reconciliation.active-publisher-commitment",
      "src/app/(reader)/country/methodology/reconciliation/page.tsx",
      "/country/methodology/reconciliation",
      "{tier1Shipped.length} active publishers",
      "site-state shipped Tier-1 publisher roster",
    ),
    runtimeClaim(
      "reconciliation.live-layer-totals",
      "src/app/(reader)/country/methodology/reconciliation/page.tsx",
      "/country/methodology/reconciliation",
      "${stats.totalFacts.toLocaleString()} rows across ${stats.distinctFactKeys} fact-keys and ${stats.activeSources} active sources",
      "getSiteStats live database counters with count-free outage fallback",
    ),
    runtimeClaim(
      "about.source-roster-count",
      "src/app/about/page.tsx",
      "/about",
      "${sourcesForDisplay.length} source records",
      "getAllSources result with generic DB-outage copy",
    ),
    exemptClaim(
      "api-docs.country-list-example",
      "src/lib/api/contract/examples.ts",
      "/api-docs",
      'Illustrative Example Response: {"data":[{"slug":"united-states"',
      "EndpointSection visibly labels every generated example response illustrative",
    ),
    exemptClaim(
      "api-docs.government-types-example",
      "src/lib/api/contract/examples.ts",
      "/api-docs",
      'Illustrative Example Response: {"data":[{"governmentType":"Presidential republic"',
      "EndpointSection visibly labels every generated example response illustrative",
    ),
    exemptClaim(
      "api-docs.by-government-type-example",
      "src/lib/api/contract/examples.ts",
      "/api-docs",
      'Illustrative Example Response: {"data":[{"key":"parliamentary_democracy"',
      "EndpointSection visibly labels every generated example response illustrative",
    ),
    exemptClaim(
      "api-docs.compare-example",
      "src/lib/api/contract/examples.ts",
      "/api-docs",
      'Illustrative Example Response: {"data":[{"jurisdiction":{"slug":"france"',
      "EndpointSection visibly labels every generated example response illustrative",
    ),
    exemptClaim(
      "api-docs.ranking-example",
      "src/lib/api/contract/examples.ts",
      "/api-docs",
      'Illustrative Example Response: {"data":[{"rank":1,"score":91.4',
      "EndpointSection visibly labels every generated example response illustrative",
    ),
    exemptClaim(
      "api-docs.peer-groupings-example",
      "src/lib/api/contract/examples.ts",
      "/api-docs",
      'Illustrative Example Response: {"data":{"world_bank_region"',
      "EndpointSection visibly labels every generated example response illustrative",
    ),
    runtimeClaim(
      "rankings.live-row-count",
      "src/app/rankings/page.tsx",
      "/rankings",
      "${rows.length} jurisdictions",
      "getRankingsMatrix returned row count with generic empty fallback",
    ),
    runtimeClaim(
      "rankings.table-row-count",
      "src/app/rankings/RankingsMatrix.tsx",
      "/rankings/RankingsMatrix.tsx",
      "${rows.length} jurisdictions · click a column header to re-sort",
      "RankingsMatrix receives the current getRankingsMatrix result rows",
    ),
    runtimeClaim(
      "elections.filtered-upcoming-count",
      "src/app/elections/ElectionsClient.tsx",
      "/elections/ElectionsClient.tsx",
      "{filteredUpcoming.length} elections",
      "client-side filtered live election result rows; omitted when none",
    ),
    runtimeClaim(
      "elections.filtered-recent-count",
      "src/app/elections/ElectionsClient.tsx",
      "/elections/ElectionsClient.tsx",
      "${filteredRecent.length} elections",
      "client-side filtered result rows with generic load-failure copy",
    ),
    runtimeClaim(
      "elections.source-coverage",
      "src/app/elections/ElectionsClient.tsx",
      "/elections/ElectionsClient.tsx",
      "{coverage.legislativeJurisdictions} national parliaments",
      "live election-source coverage object with generic DB-outage copy",
    ),
    runtimeClaim(
      "compare-index.dimension-count",
      "src/components/compare/CompareCivicaIndex.tsx",
      "component:compare/CompareCivicaIndex",
      "{V2_DIMENSIONS.length} dimensions",
      "canonical Civica Index dimension constant",
    ),
    runtimeClaim(
      "constitution.indexed-count",
      "src/components/constitution/ConstitutionLanding.tsx",
      "component:constitution/ConstitutionLanding",
      "{countries.length} national constitutions",
      "live indexed constitution rows with explicit catalog-outage state",
    ),
    runtimeClaim(
      "country-index.rendered-dimensions",
      "src/components/country/CivicaIndexPanel.tsx",
      "component:country/CivicaIndexPanel",
      "{renderedDimensionCount} governance dimensions",
      "current rendered country dimension rows",
    ),
    runtimeClaim(
      "conditions.metric-coverage",
      "src/components/outcomes/MetricStripPlot.tsx",
      "component:outcomes/MetricStripPlot",
      "Coverage: {coverage.withData} of {coverage.total} countries",
      "metric result coverage, rendered only when a coverage object exists",
    ),
    runtimeClaim(
      "country-index.dimension-count",
      "src/components/ci/CIPulseScoreDisplay.tsx",
      "component:ci/CIPulseScoreDisplay",
      "Composite of ${dimCount} governance dimensions",
      "current country composite dimension rows",
    ),
    runtimeClaim(
      "government-explorer.country-count",
      "src/components/ci/GovernmentTypesAccordionExplorer.tsx",
      "component:ci/GovernmentTypesAccordionExplorer",
      "{row.countryCount} countries",
      "runtime grouped-country result count",
    ),
    runtimeClaim(
      "almanac.catalog-count",
      "src/components/factbook/FactbookAlmanac.tsx",
      "component:factbook/FactbookAlmanac",
      "${countries.length} countries and territories",
      "runtime almanac catalog length",
    ),
    runtimeClaim(
      "home.catalog-count",
      "src/components/home/HomeGrid.tsx",
      "component:home/HomeGrid",
      '{catalogCount ?? "—"} Countries &amp; territories',
      "runtime getAllJurisdictions catalog length with nonnumeric fallback",
    ),
  ];
