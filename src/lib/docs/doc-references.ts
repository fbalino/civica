/**
 * Pure, DB-free reference-checking helpers for CLM-011's
 * `scripts/validate-doc-references.ts`.
 *
 * This module is deliberately independent of `src/lib/docs/routes.ts`'s
 * redirect-destination machinery (`destinationResolves` etc.) — that
 * checker treats a redirect target as a pass. CLM-011's job is the
 * opposite: catch prose that cites a route as if it were live when it
 * only resolves through a `next.config.ts` redirect (or doesn't resolve
 * at all). So route-existence here is checked ONLY against the direct
 * filesystem route scan (`scanAppRoutes()`), never against redirects.
 *
 * Every function is pure (string/array in, result out) so it is
 * unit-testable without touching the filesystem or a database. The
 * orchestrator script does the file reads and wires these together.
 */

import { createHash } from "node:crypto";

import type { AppRoute } from "./routes";

/* ────────────────────────────────────────────────────────────────
 * npm script mentions
 * ──────────────────────────────────────────────────────────────── */

export interface NpmScriptMention {
  /** The raw token as written, e.g. "pulse:v2:{ingest,cluster,classify,score}". */
  raw: string;
  /**
   * "exact"    — a single literal script name.
   * "expanded" — a `{a,b,c}` brace-expansion naming several scripts at once.
   * "wildcard" — a trailing `:*` family reference (e.g. "sync:*"); at
   *              least one script with that prefix must exist.
   */
  kind: "exact" | "expanded" | "wildcard";
  /** Literal script name(s) to check for "exact"/"expanded"; the bare
   *  prefix (without the trailing `:*`) for "wildcard". */
  scripts: string[];
}

// Matches a backtick-wrapped `npm run <token>` mention. <token> may be a
// plain script name, a `{a,b,c}` brace-expansion, or a `prefix:*` family.
const NPM_RUN_RE =
  /npm run ([A-Za-z0-9][A-Za-z0-9:_-]*(?:\{[A-Za-z0-9:_,-]+\})?(?:[A-Za-z0-9:_-]*)?\*?)/g;

export function extractNpmScriptMentions(text: string): NpmScriptMention[] {
  const seen = new Map<string, NpmScriptMention>();
  for (const match of text.matchAll(NPM_RUN_RE)) {
    const raw = match[1];
    if (seen.has(raw)) continue;

    const braceMatch = raw.match(/^([A-Za-z0-9:_-]*)\{([A-Za-z0-9:_,-]+)\}([A-Za-z0-9:_-]*)$/);
    if (braceMatch) {
      const [, prefix, alternatives, suffix] = braceMatch;
      const scripts = alternatives.split(",").map((alt) => `${prefix}${alt}${suffix}`);
      seen.set(raw, { raw, kind: "expanded", scripts });
      continue;
    }

    if (raw.endsWith(":*")) {
      seen.set(raw, { raw, kind: "wildcard", scripts: [raw.slice(0, -2)] });
      continue;
    }

    seen.set(raw, { raw, kind: "exact", scripts: [raw] });
  }
  return Array.from(seen.values());
}

/** Returns the mentions whose script(s) are NOT present in `knownScripts`. */
export function findUnknownNpmScripts(
  mentions: readonly NpmScriptMention[],
  knownScripts: ReadonlySet<string>,
): NpmScriptMention[] {
  const unknown: NpmScriptMention[] = [];
  for (const mention of mentions) {
    if (mention.kind === "wildcard") {
      const prefix = mention.scripts[0];
      const hasMatch = Array.from(knownScripts).some((s) => s.startsWith(`${prefix}:`));
      if (!hasMatch) unknown.push(mention);
      continue;
    }
    const missing = mention.scripts.filter((s) => !knownScripts.has(s));
    if (missing.length > 0) unknown.push({ ...mention, scripts: missing });
  }
  return unknown;
}

/* ────────────────────────────────────────────────────────────────
 * Route mentions
 * ──────────────────────────────────────────────────────────────── */

export interface RouteMention {
  /** As written, e.g. "/country/[slug]" or "/api/admin/*". */
  raw: string;
  /** True when `raw` ends in a trailing "/*" family marker. */
  isWildcardFamily: boolean;
  /** Path segments, excluding the trailing "*" wildcard marker. */
  segments: string[];
}

// A route-shaped token: leading "/", first segment starts with a word
// character (excludes the markdown-artifact "`/`" produced by two
// adjacent code spans joined with a slash, and excludes bare divisions
// like "and/or"), subsequent segments are either `[bracket]` dynamic
// segments or plain word/hyphen segments, with an optional trailing
// "/*" or "/..." wildcard-family marker (both conventions appear in
// Civica's docs — "/api/admin/*" and the architecture diagram's
// "/api/v1/..."). The trailing `(?!\.[A-Za-z])` rejects a match
// immediately followed by a file-extension-shaped ".ext" (so
// "/engravings/hero.webp" never matches as far as ".webp"), while
// still allowing a genuine sentence-ending period (". " or end of
// string) right after a hyphenated final segment like "/admin/sign-in."
// — a plain "next char isn't a word character" lookahead would instead
// backtrack past the segment's own hyphens and truncate the match.
// A truncated PREFIX can still slip through for asset paths (e.g.
// "/engravings" alone); the `NON_ROUTE_PATH_PREFIXES` skip-list below
// drops those known public/-asset directories rather than trying to
// perfect the regex further.
const INLINE_ROUTE_RE =
  /(?:^|[\s(`|>])(\/[A-Za-z0-9_][A-Za-z0-9_-]*(?:\/(?:\[[^\]/]+\]|[A-Za-z0-9_][A-Za-z0-9_-]*))*)(\/\*|\/\.\.\.)?(?!\.[A-Za-z])/g;

const ABSOLUTE_CIVICAATLAS_RE =
  /https?:\/\/(?:www\.)?civicaatlas\.org(\/[A-Za-z0-9_\-/[\]]*(?:\/\*)?)?/g;

// Top-level path segments that are `public/`-served static assets, not
// app routes — a truncated match before a file extension's "." (e.g.
// "/engravings/hero" from "/engravings/hero.webp") would otherwise be
// reported as a broken route citation.
const NON_ROUTE_PATH_PREFIXES = new Set(["engravings", "fonts"]);

function toRouteMention(pathPart: string, wildcardSuffix: string | undefined): RouteMention {
  const isWildcardFamily = Boolean(wildcardSuffix);
  const raw = pathPart + (wildcardSuffix ?? "");
  const segments = pathPart.split("/").filter(Boolean);
  return { raw, isWildcardFamily, segments };
}

export function extractRouteMentions(text: string): RouteMention[] {
  const seen = new Map<string, RouteMention>();

  for (const match of text.matchAll(INLINE_ROUTE_RE)) {
    const mention = toRouteMention(match[1], match[2]);
    if (NON_ROUTE_PATH_PREFIXES.has(mention.segments[0])) continue;
    if (!seen.has(mention.raw)) seen.set(mention.raw, mention);
  }

  for (const match of text.matchAll(ABSOLUTE_CIVICAATLAS_RE)) {
    const full = match[1] ?? "/";
    const isWildcardFamily = full.endsWith("/*");
    const pathPart = isWildcardFamily ? full.slice(0, -2) : full;
    const mention = toRouteMention(pathPart, isWildcardFamily ? "/*" : undefined);
    if (NON_ROUTE_PATH_PREFIXES.has(mention.segments[0])) continue;
    if (!seen.has(mention.raw)) seen.set(mention.raw, mention);
  }

  return Array.from(seen.values());
}

function segmentIsDynamic(seg: string): boolean {
  return /^\[.+\]$/.test(seg);
}

/**
 * Does a route mention resolve against a DIRECT app route (never a
 * redirect)? For a non-wildcard mention, segment counts must match
 * exactly; a route's dynamic (`[slug]`) segment accepts any mention
 * segment at that position (literal example value or `[bracket]`
 * notation alike), while a route's static segment must equal the
 * mention's segment exactly. For a wildcard-family mention, the
 * mention's segments only need to match as a PREFIX of some route
 * (the route may have more segments after).
 */
export function routeMentionResolves(
  mention: RouteMention,
  routes: readonly AppRoute[],
): boolean {
  return routes.some((route) => {
    const routeSegments = route.segments;
    if (mention.isWildcardFamily) {
      if (mention.segments.length > routeSegments.length) return false;
    } else if (mention.segments.length !== routeSegments.length) {
      return false;
    }
    for (let i = 0; i < mention.segments.length; i++) {
      const routeSeg = routeSegments[i];
      if (segmentIsDynamic(routeSeg)) continue;
      if (mention.segments[i] !== routeSeg) return false;
    }
    return true;
  });
}

/* ────────────────────────────────────────────────────────────────
 * Repo-relative file pointers
 * ──────────────────────────────────────────────────────────────── */

const ROOT_FILE_ALLOWLIST = new Set([
  "README.md",
  "README.template.md",
  "AGENTS.md",
  "DESIGN.md",
  ".env.example",
  "package.json",
  "drizzle.config.ts",
]);

// Backtick-wrapped repo-relative paths under a known top-level source
// directory, ending in a recognizable file extension. Deliberately
// excludes `~/civica/plan/...` references (they start with "~", not a
// directory-name word character, so they never match) — those are the
// owner-global planning convention, out of scanner scope by design.
const REPO_DIR_PATH_RE =
  /`((?:src|scripts|plan|content|analysis|docs|public|mockups)\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)`/g;
const ROOT_FILE_RE = /`([A-Za-z0-9_.-]+\.[A-Za-z0-9]+)`/g;

export function extractRepoFilePointers(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(REPO_DIR_PATH_RE)) {
    found.add(match[1]);
  }
  for (const match of text.matchAll(ROOT_FILE_RE)) {
    if (ROOT_FILE_ALLOWLIST.has(match[1])) found.add(match[1]);
  }
  return Array.from(found);
}

/* ────────────────────────────────────────────────────────────────
 * Schema table count
 * ──────────────────────────────────────────────────────────────── */

/** Counts `pgTable(` declarations in a Drizzle schema source string. */
export function countPgTableDeclarations(schemaSource: string): number {
  return (schemaSource.match(/\bpgTable\(/g) ?? []).length;
}

/** Extracts the "**N tables**" literal AGENTS.md cites in `## Database`. */
export function extractDocumentedTableCount(agentsMdText: string): number | null {
  const match = agentsMdText.match(/\*\*(\d+) tables\*\*/);
  return match ? Number(match[1]) : null;
}

/* ────────────────────────────────────────────────────────────────
 * CRON_SECRET scope wording
 * ──────────────────────────────────────────────────────────────── */

/** True if `text` still claims CRON_SECRET's scope is narrowly the
 *  Pulse cron family, rather than every `/api/cron/*` route. */
export function hasStaleCronSecretScopeClaim(text: string): boolean {
  return /\/api\/cron\/pulse\/\*/.test(text);
}

/** True if `text` documents CRON_SECRET at all (so callers can require
 *  the broad `/api/cron/*` scope to be named somewhere nearby). */
export function mentionsCronSecret(text: string): boolean {
  return /CRON_SECRET/.test(text);
}

/** True if `text` names the broad `/api/cron/*` scope. */
export function mentionsBroadCronScope(text: string): boolean {
  return /\/api\/cron\/\*/.test(text);
}

/* ────────────────────────────────────────────────────────────────
 * Project-memory runtime claims
 * ──────────────────────────────────────────────────────────────── */

/** Sealed CLM-011 drift: Atlas country redirects no longer target /factbook. */
export function hasStaleAtlasRedirectMemoryClaim(text: string): boolean {
  return /\/atlas\/:slug\(\/:tab\).*→`?\/factbook\/:slug/i.test(text);
}

/** Current direct target for the Atlas country-route family. */
export function mentionsCurrentAtlasRedirectTarget(text: string): boolean {
  return /\/atlas\/:slug\(\/:tab\).*→`?\/country\/:slug/i.test(text);
}

/* ────────────────────────────────────────────────────────────────
 * README template freshness hash
 * ──────────────────────────────────────────────────────────────── */

const TEMPLATE_HASH_RE = /Template SHA-256: ([0-9a-f]{64})/;
const GENERATED_BODY_HASH_RE = /Generated body SHA-256: ([0-9a-f]{64})/;
const GENERATED_BANNER_RE = /^<!--[\s\S]*?^-->\r?\n/m;

/** Extracts the embedded template hash from a generated README.md's banner. */
export function extractEmbeddedTemplateHash(readmeText: string): string | null {
  const match = readmeText.match(TEMPLATE_HASH_RE);
  return match ? match[1] : null;
}

/** Extracts the embedded hash of the rendered README body. */
export function extractEmbeddedGeneratedBodyHash(readmeText: string): string | null {
  const match = readmeText.match(GENERATED_BODY_HASH_RE);
  return match ? match[1] : null;
}

/**
 * Hashes only the generated README body, excluding the leading generated
 * banner. This detects direct edits to README.md without making the hash
 * self-referential.
 */
export function computeGeneratedReadmeBodyHash(readmeText: string): string {
  const body = readmeText.replace(GENERATED_BANNER_RE, "");
  return createHash("sha256").update(body, "utf8").digest("hex");
}
