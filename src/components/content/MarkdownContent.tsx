/**
 * `<MarkdownContent>` — Civica's runtime markdown renderer.
 *
 *   Adopted via: ~/civica/plan/content-templating-audit-v1.md (Phase 1)
 *   Companions:
 *     - src/lib/content/markdown/substitute.ts — substitution engine
 *     - src/lib/content/markdown/remark-civica-anchors.ts — heading
 *       anchor-id syntax (`## Heading {#anchor-id}`)
 *     - scripts/validate-content-templates.ts — build-time verifier
 *     - DESIGN.md "Editorial layout classes" — global classes the
 *       rendered markdown elements inherit typography from
 *
 * Reads a `content/*.md` file at server-render time, resolves
 * `{{state.*}}` / `{{stats.*}}` / `{{ctx.*}}` substitution markers
 * against the consumer-provided context, then renders the result via
 * `react-markdown` + `remark-gfm` (for GFM tables, footnotes, task
 * lists) + `remark-civica-anchors` (for stable heading anchors).
 *
 * Why pre-process substitutions on the raw string instead of as an
 * AST plugin: substitutions can produce structural markdown
 * (`{{ctx.tier1ShortNamesProse}}` may inject inline links, em-dashes,
 * etc. that need to re-tokenise). Substituting BEFORE the markdown
 * parser means GFM features see the post-substituted text and parse
 * normally. This is the simplest of the three approaches Phase 5 §2
 * surveyed and adopted in the audit.
 *
 * **Soft-fail discipline** matches `src/app/(reader)/methodology/approach/page.tsx`:
 * the consumer wraps `getSiteStats()` in try/catch and passes
 * `stats: null` on failure. This wrapper resolves every `{{stats.*}}`
 * marker to its `| "fallback"` value (or, if no fallback was provided,
 * leaves the literal `{{stats.x}}` in place — the validator catches
 * this case at build time so it should never ship).
 *
 * **Server-only.** This component reads from disk via Node `fs`.
 * Calling it from a client component or shipping it through a
 * client-bundled module will fail at build time. The whole point is
 * server-side rendering, with the resulting HTML shipping static.
 *
 * Per Phase 5 §4.2's wrapper specification.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { substitute, type SubstitutionContext } from "@/lib/content/markdown/substitute";
import { remarkCivicaAnchors } from "@/lib/content/markdown/remark-civica-anchors";

export interface MarkdownContentProps {
  /** Path to the markdown file, relative to the project root.
   *  Example: `"content/data-approach.md"`. */
  file: string;
  /** Typed project-state from `src/lib/content/site-state.ts`. Pass
   *  the named exports the page needs (`{ civicaIndex, pulse, ... }`),
   *  not the whole module — this both narrows the substitution
   *  surface and keeps the bundler from tree-shake-resisting unused
   *  fields. */
  state?: Record<string, unknown>;
  /** Live DB-driven counters from `getSiteStats()`. Pass `null`
   *  when the consumer's try/catch hit the catch branch (DB
   *  unreachable). */
  stats?: Record<string, unknown> | null;
  /** Pre-computed helpers (joined lists, formatted strings,
   *  conjunction-aware prose). Per Phase 5 §3.2, list-formatting
   *  logic lives at the call site, not in template syntax. */
  ctx?: Record<string, unknown>;
  /** Render only a slice of the markdown file, between two heading
   *  anchors. Both bounds are optional. `from` is inclusive (the
   *  heading itself starts the slice); `to` is exclusive (rendering
   *  stops at the line before the matching heading). Heading
   *  anchors use the `## Heading {#id}` syntax recognised by
   *  `remark-civica-anchors`.
   *
   *  Use this when a page interleaves markdown body content with
   *  TSX-only rich components (cards, charts) and you want the
   *  markdown to be the prose source of truth without splitting
   *  into multiple files.
   *
   *  Per content-templating audit v1.1 amendment 6.D (added during
   *  Phase 3.1 about-page migration to preserve the original section
   *  ordering on /about — intro → cards → how-it-works → ... →
   *  standing-posture → open-and-free). */
  slice?: { from?: string; to?: string };
  /** When true, log a warning to the server console for every
   *  unresolved `{{path}}` marker. Default true. The validation
   *  script (`npm run validate:content-templates`) is the
   *  authoritative drift detector; this is a lightweight runtime
   *  signal in dev. */
  warnOnUnresolved?: boolean;
}

/**
 * Slice a markdown body between two anchor-id heading markers.
 *
 * The matchers look for `## Heading {#id}` lines (any heading depth);
 * the slice starts at the line containing `{#from}` and stops at the
 * line containing `{#to}` (exclusive). Either bound is optional —
 * omitting `from` slices from the start of the body; omitting `to`
 * slices to the end.
 *
 * Returns the original body unchanged if either bound's anchor isn't
 * found and warnings is enabled (a console.warn surfaces the miss).
 * This is intentional fail-soft: a missing slice anchor means the
 * page renders extra prose rather than rendering nothing.
 */
function sliceMarkdownByAnchor(
  body: string,
  slice: { from?: string; to?: string },
  filePath: string,
  warn: boolean,
): string {
  const lines = body.split("\n");
  const anchorLineIdx = (id: string): number => {
    const re = new RegExp(`^#{1,6}\\s+.+\\{#${id}\\}\\s*$`);
    return lines.findIndex((line) => re.test(line));
  };
  let startLine = 0;
  let endLine = lines.length;
  if (slice.from) {
    const i = anchorLineIdx(slice.from);
    if (i === -1) {
      if (warn) {
        console.warn(
          `[MarkdownContent] ${filePath}: slice.from="${slice.from}" not found; rendering from start.`,
        );
      }
    } else {
      startLine = i;
    }
  }
  if (slice.to) {
    const i = anchorLineIdx(slice.to);
    if (i === -1) {
      if (warn) {
        console.warn(
          `[MarkdownContent] ${filePath}: slice.to="${slice.to}" not found; rendering to end.`,
        );
      }
    } else {
      endLine = i;
    }
  }
  return lines.slice(startLine, endLine).join("\n");
}

/**
 * Read a content file with a per-render cache so multiple
 * `<MarkdownContent>` invocations on the same page (rare but possible)
 * issue exactly one disk read.
 */
const readContentFile = cache(async (file: string): Promise<string> => {
  const abs = path.resolve(process.cwd(), file);
  return fs.readFile(abs, "utf8");
});

/**
 * Strip the leading authoring banner (a single HTML comment block
 * at the very top of the file). Authors put orientation notes there
 * for future maintainers; the rendered surface should not show them.
 *
 * Mirrors the same convention used by `scripts/regenerate-readme.ts`.
 */
function stripAuthoringBanner(text: string): string {
  return text.replace(/^<!--[\s\S]*?-->\n+/, "");
}

export async function MarkdownContent({
  file,
  state = {},
  stats = null,
  ctx = {},
  slice,
  warnOnUnresolved = true,
}: MarkdownContentProps) {
  const raw = await readContentFile(file);
  let body = stripAuthoringBanner(raw);

  if (slice) {
    body = sliceMarkdownByAnchor(body, slice, file, warnOnUnresolved);
  }

  const context: SubstitutionContext = { state, stats, ctx };
  const result = substitute(body, context);

  if (warnOnUnresolved) {
    if (result.unresolvedPaths.length > 0) {
      console.warn(
        `[MarkdownContent] ${file}: ${result.unresolvedPaths.length} unresolved {{path}} reference(s):`,
      );
      for (const u of result.unresolvedPaths) {
        console.warn(`  L${u.line}: {{${u.path}}}`);
      }
    }
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkCivicaAnchors]}
      // Map markdown elements to plain HTML. The surrounding
      // `.editorial-section` wrapper applies typography automatically
      // (per editorial.css), so we don't override h2/p/ul/etc.
      // GFM tables get their styling from `.editorial-section table`;
      // `table` is the one override needed, wrapping it in the shared
      // `.editorial-table-scroll` primitive so a wide table scrolls
      // horizontally on mobile instead of clipping against the body's
      // `overflow-x: clip`.
      components={{
        table: ({ children }) => (
          <div className="editorial-table-scroll">
            <table>{children}</table>
          </div>
        ),
      }}
    >
      {result.output}
    </ReactMarkdown>
  );
}
