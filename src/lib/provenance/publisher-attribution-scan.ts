/**
 * Static scan for publisher-attribution/v1 (CLM-020). Pure: the caller passes
 * every source file in scope plus the plan, ledger, and contract inputs, so
 * tests and the validator's seeded self-proof can run it on altered copies.
 *
 * Code is compared with comments removed (TypeScript printer) and whitespace
 * collapsed, so a comment can neither satisfy a required disclosure nor trip
 * a derived-field token.
 */

import ts from "typescript";

import { CIVICA_CALCULATION_DISCLOSURES } from "./publisher-attribution";
import {
  DERIVED_FIELD_READERS,
  DERIVED_FIELD_TOKENS,
  LIVE_CHECK_EXCEPTIONS,
  PROVENANCE_RENDERERS,
  PUBLISHER_ATTRIBUTION_SURFACES,
  baselineFromRegistry,
  type DerivedFieldReader,
  type LiveCheckException,
  type ProvenanceRenderer,
  type PublisherAttributionBaseline,
  type PublisherAttributionSurface,
} from "./publisher-attribution-registry";

export const PUBLISHER_ATTRIBUTION_SCAN_RULES = [
  "registry-file-missing",
  "disclosure-evidence-missing",
  "derived-field-reader-unregistered",
  "derived-field-not-allowed",
  "derived-field-reader-stale",
  "allowlist-condition-failed",
  "exception-follow-up-invalid",
  "approval-unresolved",
  "conditions-transformation-undisclosed",
  "conditions-transformation-stale",
  "conditions-disclosure-drift",
  "score-row-ids-drift",
  "provenance-renderer-unregistered",
  "provenance-renderer-stale",
  "registry-baseline-drift",
] as const;
export type PublisherAttributionScanRule =
  (typeof PUBLISHER_ATTRIBUTION_SCAN_RULES)[number];

export interface PublisherAttributionScanIssue {
  rule: PublisherAttributionScanRule;
  subject: string;
  message: string;
}

export interface ConditionsParameterContractEntry {
  direction: string;
  transformationId: string;
  lowerBound: number | null;
  upperBound: number | null;
}

export interface PublisherAttributionRegistryInput {
  surfaces: readonly PublisherAttributionSurface[];
  renderers: readonly ProvenanceRenderer[];
  readers: readonly DerivedFieldReader[];
  liveExceptions: readonly LiveCheckException[];
}

export interface PublisherAttributionScanInput {
  /** Every scanned source file (see `isPublisherAttributionScanPath`). */
  sources: ReadonlyMap<string, string>;
  /** `moduleSource` values in data/rendered-module-ledger.v1.json. */
  renderedModuleSources: ReadonlySet<string>;
  masterChecklist: string;
  followUps: string;
  decisions: string;
  conditionsParameterContract: Readonly<Record<string, ConditionsParameterContractEntry>>;
  scoreRowIds: readonly string[];
  baseline: PublisherAttributionBaseline;
  /** Defaults to the checked registry; tests and self-proof pass variants. */
  registry?: PublisherAttributionRegistryInput;
}

/** Files the scan reads: application source under src/, excluding tests. */
export function isPublisherAttributionScanPath(path: string): boolean {
  return (
    path.startsWith("src/") &&
    /\.(ts|tsx)$/.test(path) &&
    !path.endsWith(".d.ts") &&
    !/\.test\.tsx?$/.test(path) &&
    !path.includes("/__tests__/")
  );
}

const codeCache = new Map<string, string>();

/** Source code with every comment removed and whitespace collapsed. */
export function normalizedCode(path: string, source: string): string {
  const key = `${path}\u0000${source}`;
  const cached = codeCache.get(key);
  if (cached !== undefined) return cached;
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const printed = ts
    .createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed })
    .printFile(sourceFile);
  const code = collapseWhitespace(printed);
  if (codeCache.size > 2_000) codeCache.clear();
  codeCache.set(key, code);
  return code;
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Whitespace-free form, so printer spacing never decides a disclosure. */
function withoutWhitespace(text: string): string {
  return text.replace(/\s+/g, "");
}

function tokenPattern(token: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9_$])${token}(?![A-Za-z0-9_$])`);
}

const TOKEN_PATTERNS = new Map(
  DERIVED_FIELD_TOKENS.map((token) => [token, tokenPattern(token)] as const),
);

function tokensIn(code: string): string[] {
  return DERIVED_FIELD_TOKENS.filter((token) => TOKEN_PATTERNS.get(token)!.test(code));
}

const PROVENANCE_RENDER_PATTERN = /<(?:SourceDot|FactValueDot)\b/;

function approvalResolves(id: string, input: PublisherAttributionScanInput): boolean {
  if (/^APR-D\d{3}$/.test(id)) {
    return new RegExp(`^### ${id} `, "m").test(input.decisions);
  }
  if (/^[A-Z]{2,4}-\d{3}$/.test(id)) {
    return input.masterChecklist.includes(`**${id}**`);
  }
  return false;
}

function followUpResolves(id: string, input: PublisherAttributionScanInput): boolean {
  if (/^F\d+$/.test(id)) {
    return new RegExp(`^### ${id}\\b`, "m").test(input.followUps);
  }
  if (/^[A-Z]{2,4}-\d{3}$/.test(id)) {
    return new RegExp(`^- \\[ \\] \\*\\*${id}\\*\\*`, "m").test(input.masterChecklist);
  }
  return false;
}

function moduleSpecifierStem(path: string): string {
  return path.replace(/\.(ts|tsx)$/, "").split("/").at(-1)!;
}

/** Runs every rule and returns the issues; an empty array is a pass. */
export function scanPublisherAttribution(
  input: PublisherAttributionScanInput,
): PublisherAttributionScanIssue[] {
  const registry = input.registry ?? {
    surfaces: PUBLISHER_ATTRIBUTION_SURFACES,
    renderers: PROVENANCE_RENDERERS,
    readers: DERIVED_FIELD_READERS,
    liveExceptions: LIVE_CHECK_EXCEPTIONS,
  };
  const issues: PublisherAttributionScanIssue[] = [];
  const report = (
    rule: PublisherAttributionScanRule,
    subject: string,
    message: string,
  ) => issues.push({ rule, subject, message });
  const code = (path: string): string | null => {
    const source = input.sources.get(path);
    return source === undefined ? null : normalizedCode(path, source);
  };
  const surfaceById = new Map(registry.surfaces.map((surface) => [surface.id, surface]));

  // 1. Surfaces, their disclosures, and their exceptions.
  for (const surface of registry.surfaces) {
    for (const file of surface.files) {
      if (!input.sources.has(file)) {
        report("registry-file-missing", surface.id, `${file} is not an application source file`);
      }
    }
    for (const requirement of surface.evidence) {
      const fileCode = code(requirement.file);
      if (fileCode === null) {
        report("registry-file-missing", surface.id, `${requirement.file} is missing`);
        continue;
      }
      if (!withoutWhitespace(fileCode).includes(withoutWhitespace(requirement.mustContain))) {
        report(
          "disclosure-evidence-missing",
          surface.id,
          `${requirement.file} no longer contains \`${requirement.mustContain}\``,
        );
      }
    }
    if (surface.exception) {
      if (!followUpResolves(surface.exception.followUp, input)) {
        report(
          "exception-follow-up-invalid",
          surface.id,
          `follow-up ${surface.exception.followUp} is neither an open checklist task nor a follow-ups.md anchor`,
        );
      }
      if (!approvalResolves(surface.exception.approvedBy, input)) {
        report("approval-unresolved", surface.id, `approvedBy ${surface.exception.approvedBy} does not resolve`);
      }
    } else if (surface.origins.includes("civica_calculation") && surface.disclosure === "none") {
      report(
        "disclosure-evidence-missing",
        surface.id,
        "a Civica calculation without an exception needs a visible disclosure",
      );
    }
  }
  const registeredScoreRowIds = registry.surfaces
    .flatMap((surface) => (surface.scoreRowId ? [surface.scoreRowId] : []))
    .sort();
  if (registeredScoreRowIds.join("\n") !== [...input.scoreRowIds].sort().join("\n")) {
    report(
      "score-row-ids-drift",
      "country-scores",
      `registry score rows [${registeredScoreRowIds.join(", ")}] differ from SCORE_ROW_IDS [${[...input.scoreRowIds].join(", ")}]`,
    );
  }

  // 2. Provenance-renderer closure.
  const rendererByFile = new Map(registry.renderers.map((renderer) => [renderer.file, renderer]));
  const renderingFiles = new Set<string>();
  for (const [path, source] of input.sources) {
    // JSX exists only in .tsx files; a .ts string that spells the tag is data.
    if (!path.endsWith(".tsx") || !/<(?:SourceDot|FactValueDot)\b/.test(source)) continue;
    if (PROVENANCE_RENDER_PATTERN.test(code(path) ?? "")) renderingFiles.add(path);
  }
  for (const path of [...renderingFiles].sort()) {
    if (!rendererByFile.has(path)) {
      report(
        "provenance-renderer-unregistered",
        path,
        "renders a SourceDot or FactValueDot but is not classified in PROVENANCE_RENDERERS",
      );
    }
  }
  for (const renderer of registry.renderers) {
    if (!renderingFiles.has(renderer.file)) {
      report(
        "provenance-renderer-stale",
        renderer.file,
        "is registered as a provenance renderer but renders no SourceDot or FactValueDot",
      );
    }
    if (renderer.class === "surface") {
      const ids = renderer.surfaceIds ?? [];
      if (ids.length === 0) {
        report("registry-file-missing", renderer.file, "a surface renderer names no surface");
      }
      for (const id of ids) {
        const surface = surfaceById.get(id);
        if (!surface || !surface.files.includes(renderer.file)) {
          report("registry-file-missing", renderer.file, `surface ${id} does not list this file`);
        }
      }
    }
    if (renderer.class === "not_rendered" && input.renderedModuleSources.has(renderer.file)) {
      report(
        "allowlist-condition-failed",
        renderer.file,
        "is classified not_rendered but the rendered-module ledger mounts it",
      );
    }
    if (renderer.class === "admin_only" && !renderer.file.startsWith("src/app/(admin)/")) {
      report("allowlist-condition-failed", renderer.file, "admin_only renderers must live under src/app/(admin)/");
    }
    if (renderer.class === "civica_clock_unlabeled") {
      if (!renderer.followUp || !followUpResolves(renderer.followUp, input)) {
        report(
          "exception-follow-up-invalid",
          renderer.file,
          `an unlabeled Civica clock needs a resolvable follow-up (got ${renderer.followUp ?? "none"})`,
        );
      }
    }
  }

  // 3. Derived-field readers.
  const readerByFile = new Map(registry.readers.map((reader) => [reader.file, reader]));
  const notRenderedFiles = new Set(
    [...registry.readers, ...registry.renderers]
      .filter((entry) => entry.class === "not_rendered")
      .map((entry) => entry.file),
  );
  const tokenReaders = new Map<string, string[]>();
  for (const [path, source] of input.sources) {
    if (!DERIVED_FIELD_TOKENS.some((token) => source.includes(token))) continue;
    const tokens = tokensIn(code(path) ?? "");
    if (tokens.length > 0) tokenReaders.set(path, tokens);
  }
  for (const [path, tokens] of [...tokenReaders].sort(([a], [b]) => a.localeCompare(b))) {
    const reader = readerByFile.get(path);
    if (!reader) {
      report(
        "derived-field-reader-unregistered",
        path,
        `reads Civica-derived field(s) ${tokens.join(", ")} but is not in DERIVED_FIELD_READERS`,
      );
      continue;
    }
    let remaining = code(path)!;
    for (const snippet of reader.allowedSnippets ?? []) {
      remaining = remaining.split(collapseWhitespace(snippet)).join(" ");
    }
    const allowed = new Set<string>(reader.allowedTokens ?? []);
    const disallowed = tokensIn(remaining).filter((token) => !allowed.has(token));
    if (disallowed.length > 0) {
      report(
        "derived-field-not-allowed",
        path,
        `uses ${disallowed.join(", ")} beyond its ${reader.class} allowance`,
      );
    }
  }
  for (const reader of registry.readers) {
    if (!tokenReaders.has(reader.file)) {
      report(
        "derived-field-reader-stale",
        reader.file,
        input.sources.has(reader.file)
          ? "is registered as a derived-field reader but reads none"
          : "is registered as a derived-field reader but does not exist",
      );
    }
    if (!approvalResolves(reader.approvedBy, input)) {
      report("approval-unresolved", reader.file, `approvedBy ${reader.approvedBy} does not resolve`);
    }
    const readerCode = code(reader.file) ?? "";
    if (reader.class === "retired_index_api") {
      for (const guard of ["retiredIndexApiResponse()", "if (retired) return retired;"]) {
        if (!readerCode.includes(guard)) {
          report("allowlist-condition-failed", reader.file, `retired Index route lost its guard \`${guard}\``);
        }
      }
    }
    if (reader.class === "not_rendered" && input.renderedModuleSources.has(reader.file)) {
      report(
        "allowlist-condition-failed",
        reader.file,
        "is classified not_rendered but the rendered-module ledger mounts it",
      );
    }
    if (reader.class === "imported_only_by_not_rendered") {
      const stem = moduleSpecifierStem(reader.file);
      const importPattern = new RegExp(`from ["'][^"']*/${stem}["']`);
      for (const [path, source] of input.sources) {
        if (path === reader.file || !importPattern.test(source)) continue;
        if (!notRenderedFiles.has(path)) {
          report(
            "allowlist-condition-failed",
            reader.file,
            `is imported by ${path}, which is not classified not_rendered`,
          );
        }
      }
    }
    if (reader.class === "surface") {
      for (const id of reader.surfaceIds ?? []) {
        if (!surfaceById.get(id)?.files.includes(reader.file)) {
          report("registry-file-missing", reader.file, `surface ${id} does not list this file`);
        }
      }
    }
  }

  // 4. Conditions transformations and their reader explanations.
  const rankedContract = Object.entries(input.conditionsParameterContract).filter(
    ([, entry]) => entry.direction !== "not_ranked",
  );
  const contractTransformationIds = new Set(rankedContract.map(([, entry]) => entry.transformationId));
  for (const [componentId, entry] of rankedContract) {
    const disclosure = CIVICA_CALCULATION_DISCLOSURES[entry.transformationId];
    if (!disclosure) {
      report(
        "conditions-transformation-undisclosed",
        entry.transformationId,
        `the ${componentId} position has no registered reader explanation`,
      );
      continue;
    }
    if (
      disclosure.componentId !== componentId ||
      disclosure.direction !== entry.direction ||
      disclosure.lowerBound !== entry.lowerBound ||
      disclosure.upperBound !== entry.upperBound
    ) {
      report(
        "conditions-disclosure-drift",
        entry.transformationId,
        "the reader explanation's component, direction, or bounds differ from the frozen parameter contract",
      );
    }
  }
  for (const transformationId of Object.keys(CIVICA_CALCULATION_DISCLOSURES)) {
    if (!contractTransformationIds.has(transformationId)) {
      report(
        "conditions-transformation-stale",
        transformationId,
        "a reader explanation exists for a transformation the frozen contract no longer declares",
      );
    }
  }

  // 5. Live exception ledger.
  for (const exception of registry.liveExceptions) {
    if (!followUpResolves(exception.followUp, input)) {
      report(
        "exception-follow-up-invalid",
        exception.id,
        `follow-up ${exception.followUp} is neither an open checklist task nor a follow-ups.md anchor`,
      );
    }
    if (!approvalResolves(exception.approvedBy, input)) {
      report("approval-unresolved", exception.id, `approvedBy ${exception.approvedBy} does not resolve`);
    }
  }

  // 6. Baseline ratchet: exceptions and reader allowances change only on purpose.
  const current = baselineFromRegistry(registry.surfaces, registry.readers, registry.liveExceptions);
  for (const key of ["exceptions", "derivedFieldReaders"] as const) {
    const known = new Set(input.baseline[key]);
    const now = new Set(current[key]);
    const added = current[key].filter((entry) => !known.has(entry));
    const removed = input.baseline[key].filter((entry) => !now.has(entry));
    if (added.length > 0 || removed.length > 0) {
      report(
        "registry-baseline-drift",
        key,
        `${added.length ? `new: ${added.join(", ")}` : ""}${added.length && removed.length ? "; " : ""}${removed.length ? `removed: ${removed.join(", ")}` : ""}. Name the approving decision or task, then run \`npm run validate:publisher-attribution -- --update-baseline\``,
      );
    }
  }

  return issues;
}
