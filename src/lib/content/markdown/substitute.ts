/**
 * Civica content templating — substitution engine (shared core).
 *
 *   Adopted via: ~/civica/plan/content-templating-audit-v1.md (Phase 1)
 *   Companions:
 *     - src/lib/content/markdown/remark-civica-substitute.ts — runtime
 *       remark plugin that wraps this engine for the runtime renderer
 *     - src/components/content/MarkdownContent.tsx — server component
 *       wrapper around `react-markdown` + this plugin
 *     - scripts/validate-content-templates.ts — build-time verifier
 *     - scripts/regenerate-readme.ts — sister build-time consumer
 *       (originally inlined this logic; this module is its extraction)
 *
 * Substitution syntax (locked in Phase 5 design v1.0 §3, reaffirmed in
 * the content-templating audit v1.0):
 *
 *   {{path.to.field}}              dot-path traversal, including `.length`
 *                                  on arrays and strings
 *   {{path.to.field | "fallback"}} fallback string when the path is null
 *                                  or undefined (single-quoted or
 *                                  double-quoted string per §3.3)
 *
 * Top-level path segments must be one of `state`, `stats`, or `ctx`,
 * matching the Phase 5 design's context contract:
 *   { state: ..., stats: ... | null, ctx: ... }
 *
 * Soft-fail discipline (engagement requirement):
 *
 *   - When `stats === null` (DB unreachable; consumer wrapped
 *     getSiteStats() in try/catch), every {{stats.*}} reference falls
 *     through to its `| "fallback"` arg if present.
 *   - When a reference can't resolve and has no fallback, `substitute`
 *     records the path in `unresolvedPaths` and leaves the literal
 *     `{{path}}` text in the output. Rendering does NOT throw.
 *   - The validation script (`npm run validate:content-templates`)
 *     exits non-zero if any markdown file has unresolved paths,
 *     catching typos before they ship.
 *
 * The substitution engine is renderer-agnostic — it operates on plain
 * strings. The runtime renderer wraps it in a remark plugin; the
 * build-time README regenerator runs it directly. Sharing this code
 * keeps the build-time and runtime substitution behaviour identical.
 */

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

/**
 * Substitution context — the three top-level namespaces a markdown
 * `{{path}}` reference may target.
 */
export interface SubstitutionContext {
  /** Typed project-state from `src/lib/content/site-state.ts` exports. */
  state: Record<string, unknown>;
  /** Live DB-driven counters from `getSiteStats()`. `null` when the DB
   *  was unreachable and the consumer is in soft-fail mode. */
  stats: Record<string, unknown> | null;
  /** Pre-computed helpers materialised at the call site (joined lists,
   *  formatted strings, conjunction-aware prose). Per Phase 5 §3.2,
   *  filter-chains do NOT live in template syntax — they live here. */
  ctx: Record<string, unknown>;
}

export interface SubstitutionResult {
  /** Substituted text. References that couldn't resolve and had no
   *  fallback are left as their literal `{{path}}` form. */
  output: string;
  /** Paths that resolved to `undefined`/`null` AND had no fallback.
   *  Length > 0 means the consumer should investigate. */
  unresolvedPaths: Array<{ path: string; line: number }>;
  /** Paths that resolved to `undefined`/`null` but had a fallback that
   *  was used. Informational. */
  fallbacksUsed: Array<{ path: string; fallback: string; line: number }>;
}

interface ParsedRef {
  path: string;
  fallback: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Path resolution
// ─────────────────────────────────────────────────────────────────────

/**
 * Walk a dot-path against the substitution context. Returns
 * `{ found: true, value }` on success and `{ found: false }` when a
 * segment is missing.
 *
 * Special cases:
 *   - Arrays and strings expose `.length` as a synthetic property.
 *   - When `stats === null` (soft-fail), any `stats.*` lookup
 *     short-circuits to `{ found: false }` so the caller falls
 *     through to the fallback branch.
 *   - The first path segment MUST be `state`, `stats`, or `ctx`.
 *     Other roots return `{ found: false }`.
 */
export function resolvePath(
  ctx: SubstitutionContext,
  pathStr: string,
): { found: boolean; value: unknown } {
  const segments = pathStr.split(".");
  if (segments.length < 1) return { found: false, value: undefined };

  const root = segments[0];
  let current: unknown;
  if (root === "state") current = ctx.state;
  else if (root === "stats") current = ctx.stats;
  else if (root === "ctx") current = ctx.ctx;
  else return { found: false, value: undefined };

  // Soft-fail: stats is null → every stats.* lookup falls through.
  if (root === "stats" && ctx.stats === null) {
    return { found: false, value: undefined };
  }

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (current === null || current === undefined) {
      return { found: false, value: undefined };
    }
    if (
      seg === "length" &&
      (Array.isArray(current) || typeof current === "string")
    ) {
      current = (current as Array<unknown> | string).length;
      continue;
    }
    if (typeof current !== "object" || current === null) {
      return { found: false, value: undefined };
    }
    current = (current as Record<string, unknown>)[seg];
    if (current === undefined) {
      return { found: false, value: undefined };
    }
  }
  return { found: true, value: current };
}

/**
 * Parse the body of a single `{{...}}` marker (the text between the
 * delimiters). Returns either:
 *   - `{ path, fallback: null }` — plain `{{state.x}}` form
 *   - `{ path, fallback: "..." }` — pipe form `{{stats.x | "..."}}`
 * Returns `null` if the body doesn't match either grammar.
 */
export function parseRef(body: string): ParsedRef | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  // Pipe form: <path> | "<fallback>" or <path> | '<fallback>'.
  // Whitespace tolerated around the pipe.
  const pipeMatch = trimmed.match(
    /^([A-Za-z_][\w.]*)\s*\|\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*$/,
  );
  if (pipeMatch) {
    return {
      path: pipeMatch[1],
      fallback:
        pipeMatch[2] !== undefined ? pipeMatch[2] : (pipeMatch[3] ?? ""),
    };
  }

  // Plain form: just a dot-path.
  const plainMatch = trimmed.match(/^([A-Za-z_][\w.]*)\s*$/);
  if (plainMatch) {
    return { path: plainMatch[1], fallback: null };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Value formatting
// ─────────────────────────────────────────────────────────────────────

/**
 * Coerce a resolved value to a printable string. Strings + numbers +
 * booleans render as-is; arrays render as `, `-joined. Objects render
 * as JSON, which is almost certainly an authoring mistake — surface
 * it visibly rather than rendering "[object Object]".
 */
export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(formatValue).join(", ");
  return JSON.stringify(v);
}

function lineOf(text: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

// ─────────────────────────────────────────────────────────────────────
// Public substitute() — operates on plain strings
// ─────────────────────────────────────────────────────────────────────

/**
 * Resolve every `{{path}}` and `{{path | "fallback"}}` marker in
 * `template` against `ctx`, returning the substituted string plus
 * lists of unresolved paths and fallbacks-used.
 *
 * Never throws. Markers that don't match the grammar are left in
 * place and recorded as unresolved. Authoring typos surface in the
 * validation script's report.
 */
export function substitute(
  template: string,
  ctx: SubstitutionContext,
): SubstitutionResult {
  const unresolvedPaths: SubstitutionResult["unresolvedPaths"] = [];
  const fallbacksUsed: SubstitutionResult["fallbacksUsed"] = [];

  const output = template.replace(
    /\{\{([^{}]+?)\}\}/g,
    (full, body, offset: number) => {
      const ref = parseRef(body);
      const line = lineOf(template, offset);

      if (!ref) {
        // Could not parse — leave the literal in place and report.
        unresolvedPaths.push({ path: body.trim(), line });
        return full;
      }

      const { path: pathStr, fallback } = ref;
      const { found, value } = resolvePath(ctx, pathStr);

      if (!found) {
        if (fallback !== null) {
          fallbacksUsed.push({ path: pathStr, fallback, line });
          return fallback;
        }
        unresolvedPaths.push({ path: pathStr, line });
        // Leave the literal `{{path}}` in place so output diffs are
        // visible and the validator's next run spots it.
        return full;
      }

      return formatValue(value);
    },
  );

  return { output, unresolvedPaths, fallbacksUsed };
}
