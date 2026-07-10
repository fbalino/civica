/**
 * Pure HTML-tag/attribute and JSON-LD parsing + validation for the public
 * metadata contract (CLM-013). No network, no filesystem, no DOM — every
 * export here is a plain function over an already-fetched HTML string, so
 * `scripts/crawl-public-metadata.ts` (fetch-then-validate) and
 * `src/lib/seo/__tests__/metadata-contract.test.ts` (fixture-then-validate)
 * exercise the exact same logic.
 *
 * A "loc" below is the absolute apex URL a page is expected to declare as
 * both its canonical and its `og:url` — normally the `<loc>` value the page
 * was reached through in `sitemap.xml`.
 */

// ─────────────────────────────────────────────────────────────────────────
// Generic HTML tag/attribute extraction
// ─────────────────────────────────────────────────────────────────────────

export interface HtmlTag {
  tagName: string;
  attrs: Record<string, string>;
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/** Parse the raw attribute string of a single opening tag (everything after
 *  the tag name, before the closing `>`/`/>`) into a lowercase-keyed map. */
export function parseTagAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = new RegExp(ATTR_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString)) !== null) {
    const name = m[1].toLowerCase();
    attrs[name] = decodeHtmlEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#x27;|&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    );
}

/** Find every occurrence of a self-closing/void-style opening tag (e.g.
 *  `<link ...>`, `<meta ...>`) in an HTML document and return its attrs. */
export function findTags(html: string, tagName: string): HtmlTag[] {
  const re = new RegExp(`<${tagName}((?:\\s+[^<>]*)?)\\/?>`, "gi");
  const out: HtmlTag[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ tagName: tagName.toLowerCase(), attrs: parseTagAttrs(m[1] ?? "") });
  }
  return out;
}

/** All `<link rel="canonical" href="...">` hrefs on the page, in document order. */
export function extractCanonicals(html: string): string[] {
  return findTags(html, "link")
    .filter((t) => (t.attrs.rel ?? "").toLowerCase() === "canonical")
    .map((t) => t.attrs.href)
    .filter((href): href is string => Boolean(href));
}

/** All `<meta>` `content` values whose `property` OR `name` matches (case-insensitive). */
export function extractMetaByProperty(html: string, property: string): string[] {
  const wanted = property.toLowerCase();
  return findTags(html, "meta")
    .filter((t) => (t.attrs.property ?? t.attrs.name ?? "").toLowerCase() === wanted)
    .map((t) => t.attrs.content)
    .filter((c): c is string => c !== undefined);
}

/** The text content of the first `<title>` element, or null if absent. */
export function extractTitleText(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1] : null;
}

/**
 * Concatenation of every STRUCTURED metadata surface a page can use to
 * disclose research/beta status — `<title>`, meta description, og:title,
 * og:description, twitter:title, twitter:description. Deliberately excludes
 * body text: a status disclosure that only appears in rendered body copy
 * (e.g. a "Beta" chip) does not satisfy a crawler/social-card reader that
 * only reads structured metadata.
 */
export function extractStructuredMetadataText(html: string): string {
  const title = extractTitleText(html);
  return [
    title ?? "",
    ...extractMetaByProperty(html, "description"),
    ...extractMetaByProperty(html, "og:title"),
    ...extractMetaByProperty(html, "og:description"),
    ...extractMetaByProperty(html, "twitter:title"),
    ...extractMetaByProperty(html, "twitter:description"),
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// JSON-LD extraction
// ─────────────────────────────────────────────────────────────────────────

export interface JsonLdBlock {
  raw: string;
  parsed: unknown | null;
  error: string | null;
}

/** Every `<script type="application/ld+json">…</script>` block on the page,
 *  each parsed independently (a malformed block never blocks the others). */
export function extractJsonLdBlocks(html: string): JsonLdBlock[] {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out: JsonLdBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      out.push({ raw, parsed: JSON.parse(raw), error: null });
    } catch (err) {
      out.push({ raw, parsed: null, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}

/** Successfully-parsed JSON-LD nodes only (parse failures are dropped; callers
 *  that care about parse failures should inspect `extractJsonLdBlocks` directly). */
export function extractJsonLdNodes(html: string): unknown[] {
  return extractJsonLdBlocks(html)
    .filter((b): b is JsonLdBlock & { parsed: unknown } => b.error === null)
    .map((b) => b.parsed);
}

// ─────────────────────────────────────────────────────────────────────────
// Sitemap <loc> extraction
// ─────────────────────────────────────────────────────────────────────────

/** Every `<loc>…</loc>` entry in a `sitemap.xml` document, in document order. */
export function extractSitemapLocs(xml: string): string[] {
  const re = /<loc>([^<]*)<\/loc>/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(decodeXmlEntities(m[1].trim()));
  }
  return out;
}

function decodeXmlEntities(value: string): string {
  return decodeHtmlEntities(value);
}

// ─────────────────────────────────────────────────────────────────────────
// Host allow/deny
// ─────────────────────────────────────────────────────────────────────────

/** True when a URL is missing entirely, not `https://`, or resolves to a
 *  stale/preview/local host (www, `*.vercel.app`, localhost, 127.0.0.1, or
 *  any host containing "preview") instead of the production apex. */
export function hasForbiddenHost(url: string): boolean {
  if (!url) return true;
  if (/^http:\/\//i.test(url)) return true;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return true;
  }
  if (host === "www.civicaatlas.org") return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return true;
  if (host.includes("preview")) return true;
  return false;
}

/** True when `url` is an absolute URL under `siteUrl` (the apex origin). */
export function isAbsoluteApexUrl(url: string | undefined, siteUrl: string): boolean {
  if (!url) return false;
  return url === siteUrl || url.startsWith(`${siteUrl}/`);
}

// ─────────────────────────────────────────────────────────────────────────
// Page-level metadata validation
// ─────────────────────────────────────────────────────────────────────────

export interface PageMetadataInput {
  /** The absolute apex URL this page is expected to canonicalize to
   *  (typically the `<loc>` it was reached through in sitemap.xml). */
  loc: string;
  /** Apex origin, e.g. "https://civicaatlas.org". */
  siteUrl: string;
  status: number;
  html: string;
}

export interface PageMetadataResult {
  ok: boolean;
  errors: string[];
}

export function validatePageMetadata(input: PageMetadataInput): PageMetadataResult {
  const { loc, siteUrl, status, html } = input;
  const errors: string[] = [];

  if (status !== 200) {
    errors.push(`expected HTTP 200, got ${status}`);
    return { ok: false, errors };
  }

  if (!isAbsoluteApexUrl(loc, siteUrl)) {
    errors.push(`sitemap loc "${loc}" is not an absolute apex URL`);
  }

  const canonicals = extractCanonicals(html);
  if (canonicals.length !== 1) {
    errors.push(`expected exactly one canonical link, found ${canonicals.length}`);
  } else if (canonicals[0] !== loc) {
    errors.push(`canonical "${canonicals[0]}" does not equal sitemap loc "${loc}"`);
  }

  const ogUrls = extractMetaByProperty(html, "og:url");
  if (ogUrls.length !== 1) {
    errors.push(`expected exactly one og:url meta, found ${ogUrls.length}`);
  } else if (ogUrls[0] !== loc) {
    errors.push(`og:url "${ogUrls[0]}" does not equal sitemap loc "${loc}"`);
  }

  const ogImages = extractMetaByProperty(html, "og:image");
  if (ogImages.length === 0) {
    errors.push("missing og:image meta");
  } else if (!isAbsoluteApexUrl(ogImages[0], siteUrl)) {
    errors.push(`og:image "${ogImages[0]}" is not an absolute apex URL`);
  }

  const twitterCards = extractMetaByProperty(html, "twitter:card");
  if (!twitterCards.includes("summary_large_image")) {
    errors.push(
      `expected a twitter:card of "summary_large_image", found [${twitterCards.join(", ")}]`,
    );
  }

  const twitterImages = extractMetaByProperty(html, "twitter:image");
  if (twitterImages.length === 0) {
    errors.push("missing twitter:image meta");
  } else if (!isAbsoluteApexUrl(twitterImages[0], siteUrl)) {
    errors.push(`twitter:image "${twitterImages[0]}" is not an absolute apex URL`);
  }

  const robotsMeta = extractMetaByProperty(html, "robots");
  if (robotsMeta.some((c) => /noindex/i.test(c))) {
    errors.push("robots meta declares noindex");
  }

  for (const candidate of [...canonicals, ...ogUrls]) {
    if (hasForbiddenHost(candidate)) {
      errors.push(`forbidden host in canonical/og:url metadata: "${candidate}"`);
    }
  }

  for (const block of extractJsonLdBlocks(html)) {
    if (block.error) {
      errors.push(`unparseable JSON-LD block: ${block.error}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────
// Dataset JSON-LD validation (the /civica-index contract)
// ─────────────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const RESEARCH_BETA_RE = /research-beta/i;
// Tolerant of the live copy's phrasing ("...has not completed independent
// review.") as well as a more literal "not independently reviewed" — both
// satisfy "not"..."independent"..."review" in that order.
const NOT_INDEPENDENTLY_REVIEWED_RE = /not[\s\S]{0,60}independent[\s\S]{0,30}review/i;
// CLM-018 — conditionsOfAccess must explicitly separate free ACCESS from a
// reuse LICENSE, not just repeat "free" in different words.
const ACCESS_VS_REUSE_RE = /access[\s\S]{0,120}\bnot\b[\s\S]{0,60}\breuse\b/i;

export interface DatasetValidationInput {
  /** Every JSON-LD node found on the page (from `extractJsonLdNodes`). */
  nodes: unknown[];
  /** The page's canonical URL — Dataset.url must equal this. */
  canonical: string;
  /** Apex origin, e.g. "https://civicaatlas.org". */
  siteUrl: string;
}

export interface DatasetValidationResult {
  ok: boolean;
  errors: string[];
}

/** The single Dataset node on the page, or null if there isn't exactly one. */
export function findDatasetNode(nodes: unknown[]): Record<string, unknown> | null {
  const datasets = nodes.filter(
    (n): n is Record<string, unknown> => isRecord(n) && n["@type"] === "Dataset",
  );
  return datasets.length === 1 ? datasets[0] : null;
}

export function validateDatasetNode(input: DatasetValidationInput): DatasetValidationResult {
  const errors: string[] = [];
  const datasets = input.nodes.filter(
    (n): n is Record<string, unknown> => isRecord(n) && n["@type"] === "Dataset",
  );

  if (datasets.length !== 1) {
    errors.push(`expected exactly one Dataset node, found ${datasets.length}`);
    return { ok: false, errors };
  }
  const node = datasets[0];

  if (node["@context"] !== "https://schema.org") {
    errors.push(
      `Dataset.@context must equal "https://schema.org", found "${String(node["@context"])}"`,
    );
  }

  if (typeof node.name !== "string" || node.name.trim() === "") {
    errors.push("Dataset.name must be a nonempty string");
  }

  const description = typeof node.description === "string" ? node.description : "";
  if (description.trim() === "") {
    errors.push("Dataset.description must be a nonempty string");
  }
  if (!RESEARCH_BETA_RE.test(description)) {
    errors.push('Dataset.description must mention "research-beta"');
  }
  if (!NOT_INDEPENDENTLY_REVIEWED_RE.test(description)) {
    errors.push("Dataset.description must disclose that the methodology is not independently reviewed");
  }

  if (node.url !== input.canonical) {
    errors.push(`Dataset.url "${String(node.url)}" does not match canonical "${input.canonical}"`);
  } else if (!isAbsoluteApexUrl(String(node.url), input.siteUrl)) {
    errors.push(`Dataset.url "${String(node.url)}" is not an apex URL`);
  }

  for (const field of ["creator", "publisher"] as const) {
    const value = node[field];
    const id = isRecord(value) ? value["@id"] : typeof value === "string" ? value : undefined;
    if (typeof id !== "string" || !isAbsoluteApexUrl(id, input.siteUrl)) {
      errors.push(`Dataset.${field} must be present and reference the apex site`);
    }
  }

  const expectedRightsUrl = `${input.siteUrl}/licensing#reuse`;
  if (node.license !== expectedRightsUrl) {
    errors.push(`Dataset.license must equal the canonical rights registry URL ${expectedRightsUrl}`);
  }

  const conditionsOfAccess =
    typeof node.conditionsOfAccess === "string" ? node.conditionsOfAccess : "";
  if (conditionsOfAccess.trim() === "") {
    errors.push("Dataset.conditionsOfAccess must be a nonempty string");
  } else if (!ACCESS_VS_REUSE_RE.test(conditionsOfAccess)) {
    errors.push(
      "Dataset.conditionsOfAccess must disclose that free access is not a reuse license",
    );
  }

  if (typeof node.isAccessibleForFree !== "boolean") {
    errors.push("Dataset.isAccessibleForFree must be a boolean");
  }

  const distribution = Array.isArray(node.distribution) ? node.distribution : [];
  const distributionOk = distribution.some(
    (d) =>
      isRecord(d) &&
      d["@type"] === "DataDownload" &&
      typeof d.encodingFormat === "string" &&
      d.encodingFormat.trim() !== "" &&
      isAbsoluteApexUrl(d.contentUrl as string | undefined, input.siteUrl),
  );
  if (!distributionOk) {
    errors.push(
      "Dataset.distribution must include at least one DataDownload with a nonempty encodingFormat and an apex contentUrl",
    );
  }

  if (
    node.temporalCoverage !== undefined &&
    (typeof node.temporalCoverage !== "string" || node.temporalCoverage.trim() === "")
  ) {
    errors.push("Dataset.temporalCoverage, when present, must be nonempty");
  }

  return { ok: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────
// Route-status predicate — which routes must disclose research posture, and
// what language satisfies that disclosure. Exported so both the crawler and
// tests share one definition of "Index-facing" / "Pulse-facing".
// ─────────────────────────────────────────────────────────────────────────

export type RouteStatusClass = "pulse" | "index" | "none";

// Pulse-facing paths are checked BEFORE the broader Index-facing pattern —
// they're a subset of /civica-index and carry their own, stricter language.
const PULSE_FACING_PATTERN = /^\/civica-index\/(pulse-changelog|methodology\/pulse)(\/|$)/;
const INDEX_FACING_PATTERN = /^\/civica-index(\/|$)/;
// Index-facing surfaces beyond the /civica-index namespace itself: the
// rankings leaderboard, the country-comparison tool (query string is not
// part of `pathname`, so `/compare?c=a&c=b` classifies the same as
// `/compare`), and each country's Civica Data tab.
const INDEX_FACING_EXTRA_PATTERN =
  /^\/(rankings|compare)(\/|$)|^\/country\/[^/]+\/civica-data(\/|$)/;

export function classifyRouteStatus(pathname: string): RouteStatusClass {
  if (PULSE_FACING_PATTERN.test(pathname)) return "pulse";
  if (INDEX_FACING_PATTERN.test(pathname) || INDEX_FACING_EXTRA_PATTERN.test(pathname)) {
    return "index";
  }
  return "none";
}

const INDEX_STATUS_RE = /\b(beta|research-experiment|research experiment)\b/i;
const PULSE_STATUS_RE = /\b(experimental|archived-diagnostic|archived diagnostic)\b/i;

/**
 * Does this page's STRUCTURED metadata — `<title>`, meta description,
 * og:title/og:description, twitter:title/twitter:description — carry the
 * disclosure required for this route's status class? Always true for
 * routes with no applicable class.
 *
 * `html` must be the full page source; this function extracts the
 * structured-metadata surfaces itself and deliberately never inspects body
 * text — a "Beta" chip rendered only in the page body does not satisfy a
 * crawler/social-card reader that only sees `<head>` metadata.
 */
export function routeStatusSatisfied(pathname: string, html: string): boolean {
  const cls = classifyRouteStatus(pathname);
  if (cls === "none") return true;
  const text = extractStructuredMetadataText(html);
  if (cls === "pulse") return PULSE_STATUS_RE.test(text);
  return INDEX_STATUS_RE.test(text);
}

// ─────────────────────────────────────────────────────────────────────────
// Argument-less `new Date()` detection — sitemap.ts must derive every
// `lastModified` from a stored/checked-in value, never the request-time
// clock. `new Date(x)` (any argument) is never flagged.
// ─────────────────────────────────────────────────────────────────────────

/** Blank out `//` and `/* *\/` comment bodies (preserving length/newlines, so
 *  offsets still map onto the original source) so prose that merely
 *  mentions the literal text never trips detection. String/template
 *  contents are left intact. */
export function maskComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  type Mode = "code" | "line" | "block" | "sq" | "dq" | "tpl";
  let mode: Mode = "code";

  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];

    if (mode === "code") {
      if (c === "/" && c2 === "/") {
        mode = "line";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "/" && c2 === "*") {
        mode = "block";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "'" || c === '"' || c === "`") {
        mode = c === "'" ? "sq" : c === '"' ? "dq" : "tpl";
        out += c;
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }

    if (mode === "line") {
      if (c === "\n") {
        mode = "code";
        out += c;
      } else {
        out += c === "\t" ? "\t" : " ";
      }
      i++;
      continue;
    }

    if (mode === "block") {
      if (c === "*" && c2 === "/") {
        mode = "code";
        out += "  ";
        i += 2;
        continue;
      }
      out += c === "\n" ? "\n" : c === "\t" ? "\t" : " ";
      i++;
      continue;
    }

    // String / template modes: preserve content; honour escapes.
    out += c;
    if (c === "\\") {
      out += source[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (mode === "sq" && c === "'") mode = "code";
    else if (mode === "dq" && c === '"') mode = "code";
    else if (mode === "tpl" && c === "`") mode = "code";
    i++;
  }

  return out;
}

/** Byte offsets of every argument-less `new Date()` call in a source string,
 *  ignoring occurrences inside `//`/`/* *\/` comments. */
export function findArgumentlessNewDateCalls(source: string): number[] {
  const masked = maskComments(source);
  const re = /\bnew\s+Date\s*\(\s*\)/g;
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    out.push(m.index);
  }
  return out;
}

export function hasArgumentlessNewDate(source: string): boolean {
  return findArgumentlessNewDateCalls(source).length > 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Forbidden-host literal scan for TS/TSX source (not HTML) — used by
// `scripts/validate-metadata.ts` to sweep every metadata-emitting surface
// (core SEO files + every `src/app` file that exports `metadata`/
// `generateMetadata`) for a hardcoded stale/preview host. Comments are
// masked first so prose that merely *describes* a forbidden host (e.g. a
// doc comment explaining why preview hosts are rejected) never trips
// detection — only literal occurrences in real code/strings do.
// ─────────────────────────────────────────────────────────────────────────

export interface ForbiddenHostSourcePattern {
  label: string;
  re: RegExp;
}

export const FORBIDDEN_HOST_SOURCE_PATTERNS: ForbiddenHostSourcePattern[] = [
  { label: "www.civicaatlas.org", re: /www\.civicaatlas\.org/i },
  { label: "*.vercel.app", re: /[a-z0-9-]+\.vercel\.app/i },
  { label: "localhost", re: /localhost/i },
  { label: "127.0.0.1", re: /127\.0\.0\.1/ },
  {
    label: "preview host",
    re: /(?:https?:\/\/)?preview[a-z0-9.-]*\.(?:vercel\.app|civicaatlas\.org)|https?:\/\/preview\./i,
  },
  { label: "http://civicaatlas", re: /http:\/\/civicaatlas/i },
];

/** Which `FORBIDDEN_HOST_SOURCE_PATTERNS` labels appear in `source`, ignoring
 *  matches that occur only inside `//`/`/* *\/` comments. */
export function findForbiddenHostPatternsInSource(source: string): string[] {
  const masked = maskComments(source);
  return FORBIDDEN_HOST_SOURCE_PATTERNS.filter((p) => p.re.test(masked)).map((p) => p.label);
}
