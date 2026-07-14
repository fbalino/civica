/**
 * Article-body extraction for the Pulse v2 news pipeline.
 *
 * WHY THIS EXISTS
 * ---------------
 * GDELT (our highest-volume news source) returns only a headline + URL — never
 * article text. The GDELT connector previously set each row's `body` to just the
 * outlet domain (e.g. "eturbonews.com"), so the classifier only ever saw the
 * headline plus the website name. For ambiguous headlines the model can't
 * categorise/summarise (and in old runs even refused). Specialist feeds
 * (HRW/Amnesty, CIVICUS, Reuters/AP via `rss.ts`) already fill `body` from
 * `contentSnippet`/`content`, so ONLY GDELT rows need this fetch-and-extract.
 *
 * `extractArticleText(url)` fetches the page, parses it with `node-html-parser`
 * (already a dependency — see `src/lib/constitute/sync-constitutions.ts`), and
 * returns readable article text or `null`. It NEVER throws: callers treat `null`
 * as "no body available" and keep whatever fallback they already have (the
 * domain name), so a paywall / 403 / thin page can never regress an ingest.
 */

import { parse, type HTMLElement } from "node-html-parser";

import {
  fetchPublicHttpBytes,
  PublicHttpError,
  type PublicHttpResponse,
} from "@/lib/net/public-http";

/** Descriptive UA so outlets can identify / allow the crawler. */
const USER_AGENT =
  "CivicaAtlasBot/1.0 (+https://civicaatlas.org; governance-event classification)";

/** Per-request fetch timeout. Overridable via PULSE_ARTICLE_FETCH_TIMEOUT_MS. */
const DEFAULT_TIMEOUT_MS = 12_000;

/** Cap extracted text so a huge page can't bloat a classify prompt. */
const MAX_CHARS = 4000;

/** Cap decoded HTML before it is allocated or passed to the parser. */
const MAX_HTML_BYTES = 1_048_576;

/** Below this, extracted text is too thin to help the classifier — return null
 *  and let the caller keep its headline-only fallback. */
const MIN_USEFUL_CHARS = 200;

/** Statuses worth one retry with backoff — rate limit + transient upstream. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

const RETRYABLE_FETCH_ERROR = new Set([
  "DNS_LOOKUP_FAILED",
  "REQUEST_ABORTED",
  "REQUEST_FAILED",
  "BODY_READ_FAILED",
]);

function resolveTimeoutMs(): number {
  const raw = Number(process.env.PULSE_ARTICLE_FETCH_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/**
 * fetch() with a single retry on transient failures (connect error or a
 * 429/5xx response). Mirrors the backoff shape of `fetchWithRetry` in
 * `src/lib/pulse/gdelt.ts` but trimmed to one retry — article fetches are
 * best-effort and run in bulk, so we don't want to stall the batch on any
 * one stubborn URL.
 */
async function fetchArticleOnce(
  url: string,
): Promise<PublicHttpResponse | null> {
  const attempts = 2; // 1 initial + 1 retry
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchPublicHttpBytes(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        maxBodyBytes: MAX_HTML_BYTES,
        maxRedirects: 3,
        signal: AbortSignal.timeout(resolveTimeoutMs()),
      });
      if (RETRYABLE_STATUS.has(res.status) && i < attempts - 1) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoffMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 8_000)
            : 1500;
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof PublicHttpError && RETRYABLE_FETCH_ERROR.has(err.code);
      if (retryable && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        return null;
      }
    }
  }
  // Both attempts failed with a thrown error (timeout / DNS / reset): treat as
  // "no body available" rather than surfacing — callers only care about text.
  void lastErr;
  return null;
}

/** Decode the handful of HTML entities `node-html-parser`'s `.text` leaves
 *  behind (it decodes numeric but not most named entities). Covers the common
 *  punctuation/space cases so classifier bodies read cleanly; anything else is
 *  harmless residue. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  middot: "·",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  szlig: "ß",
  ntilde: "ñ",
  deg: "°",
  euro: "€",
  pound: "£",
  copy: "©",
  reg: "®",
  trade: "™",
};

function decodeEntities(s: string): string {
  return (
    s
      // Numeric (decimal + hex) — safety net; most are already decoded.
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
        codePointOrEmpty(parseInt(h, 16)),
      )
      .replace(/&#(\d+);/g, (_, d) => codePointOrEmpty(parseInt(d, 10)))
      // Named entities we care about.
      .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m)
  );
}

function codePointOrEmpty(cp: number): string {
  if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return "";
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

/** Collapse runs of whitespace, decode entities, drop empty / boilerplate. */
function cleanText(raw: string): string {
  const lines = decodeEntities(raw)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0)
    // Drop obvious chrome/boilerplate one-liners that survive tag stripping.
    .filter((l) => !isBoilerplateLine(l));
  // De-dupe consecutive identical lines (nav/menu echoes).
  const deduped: string[] = [];
  for (const l of lines) {
    if (deduped[deduped.length - 1] !== l) deduped.push(l);
  }
  return deduped.join(" ").replace(/\s+/g, " ").trim();
}

const BOILERPLATE_PATTERNS: RegExp[] = [
  /^(share|tweet|print|email this|subscribe|sign in|log in|advertisement|cookie|accept cookies)\b/i,
  /^(read more|related articles?|most read|trending|follow us)\b/i,
  /^©/,
  /^all rights reserved/i,
];

function isBoilerplateLine(line: string): boolean {
  if (line.length < 3) return true;
  return BOILERPLATE_PATTERNS.some((re) => re.test(line));
}

/** Remove chrome nodes that pollute article text before extraction. */
function stripChrome(root: HTMLElement): void {
  const selectors = [
    "script",
    "style",
    "noscript",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "iframe",
    "svg",
  ];
  for (const sel of selectors) {
    for (const el of root.querySelectorAll(sel)) {
      el.remove();
    }
  }
}

/** meta description / og:description, if present — a clean one-line summary
 *  that anchors the classifier even when the body extraction is weak. */
function metaDescription(root: HTMLElement): string {
  const metas = root.querySelectorAll("meta");
  for (const m of metas) {
    const name = (m.getAttribute("name") ?? "").toLowerCase();
    const prop = (m.getAttribute("property") ?? "").toLowerCase();
    if (name === "description" || prop === "og:description") {
      const content = (m.getAttribute("content") ?? "").trim();
      if (content) return content;
    }
  }
  return "";
}

/**
 * Concatenate <p> text within the container that holds the most paragraph
 * text. Handles the common case where <article> is absent but the body sits in
 * a `<div class="content">`-style block surrounded by nav/promo columns.
 */
function densestParagraphText(root: HTMLElement): string {
  const paragraphs = root.querySelectorAll("p");
  if (paragraphs.length === 0) return "";

  // Group paragraphs by their parent and keep the parent with the most text.
  const byParent = new Map<HTMLElement, { text: string; len: number }>();
  for (const p of paragraphs) {
    const parent = p.parentNode as HTMLElement | null;
    if (!parent) continue;
    const t = p.text.replace(/\s+/g, " ").trim();
    if (t.length < 40) continue; // skip captions / one-word <p>s
    const entry = byParent.get(parent) ?? { text: "", len: 0 };
    entry.text += t + "\n";
    entry.len += t.length;
    byParent.set(parent, entry);
  }

  let best = "";
  let bestLen = 0;
  for (const { text, len } of byParent.values()) {
    if (len > bestLen) {
      bestLen = len;
      best = text;
    }
  }
  return best;
}

/**
 * Fetch a news article and return readable body text, or null.
 *
 * Extraction order:
 *   1. strip <script>/<style>/<nav>/<header>/<footer>/<aside> (+ form/iframe/svg)
 *   2. prefer the first <article> if it has substantial text
 *   3. else concatenate <p> tags within the largest text-dense container
 *   4. prepend meta/og:description if present
 *   5. collapse whitespace, drop boilerplate lines, cap at ~4000 chars
 *
 * Returns null when: non-HTML content-type, fetch fails / is blocked
 * (403 / paywall), or the extracted text is < ~200 chars (too thin to help).
 * NEVER throws.
 */
export async function extractArticleText(url: string): Promise<string | null> {
  let res: PublicHttpResponse | null;
  try {
    res = await fetchArticleOnce(url);
  } catch {
    return null;
  }
  if (!res || !res.ok) return null;

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (contentType && !contentType.includes("html")) return null;

  const html = new TextDecoder("utf-8").decode(res.body);
  if (!html || html.length < 200) return null;

  let root: HTMLElement;
  try {
    root = parse(html, { comment: false });
  } catch {
    return null;
  }

  const description = metaDescription(root);
  stripChrome(root);

  // 2. Prefer <article> if it carries substantial text.
  let bodyText = "";
  const articleEl = root.querySelector("article");
  if (articleEl) {
    const t = articleEl.text.replace(/\s+/g, " ").trim();
    if (t.length >= MIN_USEFUL_CHARS) {
      // Re-extract paragraph text from within the article for cleaner output
      // (article.text can include stray widget labels); fall back to raw.
      bodyText = densestParagraphText(articleEl) || t;
    }
  }

  // 3. Fall back to the densest <p> container in the whole document.
  if (bodyText.length < MIN_USEFUL_CHARS) {
    bodyText = densestParagraphText(root);
  }

  // 4. Prepend the meta description (deduped if it's already the lede).
  const cleanedBody = cleanText(bodyText);
  let combined = cleanedBody;
  if (description) {
    const descClean = decodeEntities(description).replace(/\s+/g, " ").trim();
    combined =
      cleanedBody && !cleanedBody.startsWith(descClean.slice(0, 60))
        ? `${descClean} ${cleanedBody}`
        : cleanedBody || descClean;
  }

  const final = combined.slice(0, MAX_CHARS).trim();
  if (final.length < MIN_USEFUL_CHARS) return null;
  return final;
}
