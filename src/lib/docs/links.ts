/**
 * Static internal-link and heading-anchor extraction/validation
 * (CLM-009 §6, extended by bounded-repair F2). Pure and regex-based.
 *
 * Markdown extraction (`extractInternalLinks`, `extractHeadingAnchorIds`)
 * covers `content/*.md`. Anchor-id convention mirrors
 * `remark-civica-anchors` / `MarkdownContent`'s own slice-anchor
 * regex: `## Heading {#id}`.
 *
 * TSX extraction (`extractStaticTsxLinks`, `extractTsxSectionAnchorIds`)
 * is deliberately STATIC-ONLY: it matches `href="/literal"` /
 * `href='/literal'` and `id="literal"` string-literal attributes via
 * regex, and makes no attempt to evaluate a dynamic JSX expression
 * (`href={...}`, `id={...}`) — those are silently absent from the
 * extracted result, never coerced into a "valid" or "invalid" link.
 * Per CLM-009 §6 ("skip dynamic JSX expressions rather than
 * guessing"): a skipped dynamic expression is not checked at all, and
 * must never be reported as passing.
 */

export function extractHeadingAnchorIds(content: string): Set<string> {
  const ids = new Set<string>();
  const re = /^#{1,6}\s+.+\{#([a-zA-Z0-9-]+)\}\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

export interface InternalLink {
  href: string;
  /** 1-indexed line number. */
  line: number;
}

/** Extract `[text](href)` markdown links whose href is internal
 *  (starts with `/` or `#`). External links (http(s)://, mailto:)
 *  and bare autolinks are out of scope. */
export function extractInternalLinks(content: string): InternalLink[] {
  const links: InternalLink[] = [];
  const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  content.split("\n").forEach((line, i) => {
    let m: RegExpExecArray | null;
    linkRe.lastIndex = 0;
    while ((m = linkRe.exec(line)) !== null) {
      const href = m[1];
      if (href.startsWith("/") || href.startsWith("#")) {
        links.push({ href, line: i + 1 });
      }
    }
  });
  return links;
}

export interface LinkCheck {
  href: string;
  line: number;
  ok: boolean;
  reason?: string;
}

/**
 * Check one internal link against the CURRENT document's own heading
 * anchors (same-document `#id` links only). Cross-document links
 * (`/path` or `/path#id`) are `checkCrossDocumentLink`'s job below.
 */
export function checkSameDocumentAnchorLink(
  link: InternalLink,
  anchorIds: ReadonlySet<string>,
): LinkCheck {
  if (!link.href.startsWith("#")) {
    return { ...link, ok: true };
  }
  const id = link.href.slice(1);
  if (anchorIds.has(id)) {
    return { ...link, ok: true };
  }
  return {
    ...link,
    ok: false,
    reason: `no heading with anchor id "#${id}" in this document`,
  };
}

/** Extract STATIC `href="/literal"` values from TSX/JSX source
 *  (`<Link href="/x">`, `<a href="/x">`). Only internal
 *  (`/`-prefixed) string-literal hrefs are returned; a dynamic
 *  expression (`href={...}`) never matches this regex and is simply
 *  absent from the result — see module docstring. */
export function extractStaticTsxLinks(content: string): InternalLink[] {
  const links: InternalLink[] = [];
  const hrefRe = /\bhref=(["'])(\/[^"'{}]*)\1/g;
  content.split("\n").forEach((line, i) => {
    let m: RegExpExecArray | null;
    hrefRe.lastIndex = 0;
    while ((m = hrefRe.exec(line)) !== null) {
      links.push({ href: m[2], line: i + 1 });
    }
  });
  return links;
}

/** Extract STATIC `id="literal"` attribute values from TSX/JSX source
 *  (Civica's reader pages define section anchors this way, e.g.
 *  `<Reveal as="section" id="summary">`, rather than markdown
 *  headings). A dynamic `id={...}` expression never matches and is
 *  absent from the result. */
export function extractTsxSectionAnchorIds(content: string): Set<string> {
  const ids = new Set<string>();
  const idRe = /\bid=(["'])([a-zA-Z0-9-]+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(content)) !== null) {
    ids.add(m[2]);
  }
  return ids;
}

/**
 * Check one internal link (`href` starting with `/`, optionally
 * `/path#anchor`) against (a) the route resolver — a thin wrapper
 * around `destinationResolves` from `src/lib/docs/routes.ts` so this
 * module stays route-scanner-agnostic — and (b) a pooled set of known
 * anchor ids gathered from every registered reader surface
 * (`extractHeadingAnchorIds` over `content/*.md` UNION
 * `extractTsxSectionAnchorIds` over registered reader-tsx files).
 *
 * The anchor check is intentionally a POOLED, not a per-route,
 * lookup: Civica's page shells commonly compose more than one
 * markdown slice plus TSX-only sections into a single route (see
 * `MarkdownContent`'s `slice` prop), so a precise route→anchor-set
 * mapping would require guessing which slice serves which route. A
 * pooled check can't produce a false "route doesn't exist" (that's
 * strictly checked), and for the anchor it asks the honestly bounded
 * question "does this anchor exist ANYWHERE in scanned content" —
 * still enough to catch the common case (a typo'd or removed anchor
 * id) without pretending to a precision the extractor doesn't have.
 */
export function checkCrossDocumentLink(
  link: InternalLink,
  routeResolver: (path: string) => boolean | "skipped",
  knownAnchorIds: ReadonlySet<string>,
): LinkCheck {
  const hashIdx = link.href.indexOf("#");
  const pathPart = hashIdx === -1 ? link.href : link.href.slice(0, hashIdx);
  const anchorPart = hashIdx === -1 ? null : link.href.slice(hashIdx + 1);

  if (pathPart) {
    const result = routeResolver(pathPart);
    if (result === false) {
      return {
        ...link,
        ok: false,
        reason: `route "${pathPart}" does not resolve to any known app route`,
      };
    }
  }

  if (anchorPart && !knownAnchorIds.has(anchorPart)) {
    return {
      ...link,
      ok: false,
      reason: `anchor "#${anchorPart}" not found among registered content/reader-tsx anchors`,
    };
  }

  return { ...link, ok: true };
}
