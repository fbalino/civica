/**
 * Pure GEN:START/GEN:END marker-block extraction (CLM-009 §7, revised
 * in the browser-QA repair round).
 *
 * Marker syntax is a Markdown-native invisible-comment convention —
 * an unused link reference definition, `[//]: # "..."` — NOT an HTML
 * comment. `react-markdown` (no `rehype-raw`) renders a raw `<!-- -->`
 * HTML comment as ESCAPED VISIBLE TEXT (confirmed by CLM-009 browser
 * QA: the markers rendered on the page). A link reference definition,
 * by contrast, is consumed entirely during Markdown parsing and never
 * reaches the render tree — CommonMark defines it as a block-level
 * construct that produces no output. Verified against the exact
 * production pipeline (`ReactMarkdown` + `remarkGfm` +
 * `remarkCivicaAnchors`, rendered via `renderToStaticMarkup`): zero
 * bytes of visible output, including with two independent marker
 * pairs reusing the same `//` label (CommonMark permits duplicate
 * definition labels; only the first is "live" for resolving an actual
 * reference, and none of our markers are ever referenced).
 *
 * Each marker occupies its own line, framed by BLANK lines on both
 * sides:
 *
 *   [//]: # "GEN:START <markerName> (source: <path>)"
 *
 *   ...body...
 *
 *   [//]: # "GEN:END <markerName>"
 *
 * The blank-line framing is REQUIRED, not cosmetic: without it, a GFM
 * table immediately followed by `[//]: # "GEN:END ..."` on the very
 * next line gets misparsed — remark-gfm folds the END line into the
 * table as a garbled extra row, and `[//]` there resolves as an
 * ACTUAL reference-link USE against the START definition (rendering a
 * visible stray link). Confirmed by direct rendering test; do not
 * remove the blank lines when regenerating.
 *
 * Shared by `scripts/validate-doc-sources.ts` (drift/scan support for
 * a marker NAME, without needing to know each generator's exact
 * "(source: ...)" suffix text) and the doc-concepts test fixtures.
 * The two generator scripts (`generate-ci-normalization-table.ts`,
 * `generate-pca-analysis.ts`) keep their own simpler exact-string
 * marker matching — they own one fixed marker each and are already
 * working; this module exists for the general case.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface GenBlock {
  /** Index in `content` immediately after the START marker line (and
   *  its following blank line). */
  startIdx: number;
  /** Index in `content` at the start of the END marker line. */
  endIdx: number;
  /** Current block body, with the framing blank lines trimmed. */
  body: string;
}

/**
 * Find a `[//]: # "GEN:START <markerName> ..."` ... `[//]: # "GEN:END
 * <markerName>"` block by marker name. The START marker's title text
 * may carry an arbitrary trailing comment (e.g. `(source: ...)`); only
 * the END marker's exact text is required. Returns `null` if either
 * marker is missing.
 */
export function extractGenBlock(
  content: string,
  markerName: string,
): GenBlock | null {
  // Requires the mandatory blank line after the START marker line —
  // `startIdx` lands exactly at the first character of the body, no
  // leading whitespace to trim.
  const startRe = new RegExp(
    `\\[//\\]: # "GEN:START ${escapeRegExp(markerName)}[^"\\n]*"\\n\\n`,
  );
  const startMatch = startRe.exec(content);
  if (!startMatch) return null;
  const startIdx = startMatch.index + startMatch[0].length;

  const endMarker = `[//]: # "GEN:END ${markerName}"`;
  const endIdx = content.indexOf(endMarker, startIdx);
  if (endIdx === -1) return null;

  // Trailing newlines here are the mandatory blank line before the
  // END marker — trim it so `body` is exactly the meaningful content.
  const body = content.slice(startIdx, endIdx).replace(/\n+$/, "");
  return { startIdx, endIdx, body };
}

/** Replace an existing GEN block's body, preserving the marker lines
 *  and their required blank-line framing. Returns `null` if the
 *  markers aren't found. */
export function replaceGenBlock(
  content: string,
  markerName: string,
  newBody: string,
): string | null {
  const block = extractGenBlock(content, markerName);
  if (!block) return null;
  return `${content.slice(0, block.startIdx)}${newBody}\n\n${content.slice(block.endIdx)}`;
}

/**
 * Return `content` with every GEN block's interior replaced by
 * blank lines (same line count preserved, so caller-reported line
 * numbers for anything found outside a generated block stay accurate).
 * Used by the formula-fingerprint scanner to build an
 * "outside-generated-content" view without needing to know marker
 * names in advance.
 */
export function stripAllGenBlocks(content: string): string {
  return content.replace(
    /\[\/\/\]: # "GEN:START [^"\n]*"\n[\s\S]*?\[\/\/\]: # "GEN:END [^"\n]*"/g,
    (match) => {
      const newlineCount = (match.match(/\n/g) ?? []).length;
      return "\n".repeat(newlineCount);
    },
  );
}
