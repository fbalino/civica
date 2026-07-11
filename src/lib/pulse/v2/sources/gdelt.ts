/**
 * GDELT — global news events.
 * License: open data
 *
 * Adapts the v1 GDELT fetcher (`src/lib/pulse/gdelt.ts`) to the
 * v2 raw_events shape. Highest-volume news source — typically
 * 200–250 articles per 24h with the governance-terms query.
 *
 * Important per spec §2.3: GDELT is a *secondary* / corroboration
 * source in the v2 architecture, not a primary trigger. Events
 * appearing only in GDELT (no specialist-feed corroboration) are
 * weighted lower under the source-diversity and positive-event rules
 * countries — that logic lives in `corroborate.ts`, not here.
 *
 * BODY ENRICHMENT: GDELT returns only headline + URL, never article
 * text. Without a body the classifier sees just the headline plus the
 * outlet domain, which is too thin for ambiguous stories. After the
 * rows are built we fetch each article and replace the domain-name
 * placeholder with extracted text (`article-extract.ts`), bounded to a
 * small concurrent pool. This is strictly best-effort: any URL that
 * fails / is paywalled keeps the domain-name fallback, and one bad URL
 * never fails the ingest. Controlled by PULSE_ARTICLE_FETCH (on|off,
 * default on) and PULSE_ARTICLE_FETCH_CONCURRENCY (default 5).
 */

import {
  fetchGdeltEvents,
  parseArticleDate,
  extractSourceName,
} from "../../gdelt";
import { extractArticleText } from "../article-extract";
import { resolveCountry, type JurisdictionMap } from "../country-resolver";
import type { RawEventInput } from "../types";

const SOURCE_ID = "gdelt";

const DEFAULT_CONCURRENCY = 5;

/** PULSE_ARTICLE_FETCH — "off" disables body enrichment (headline-only,
 *  the pre-enrichment behaviour). Anything else (incl. unset) = on. */
function articleFetchEnabled(): boolean {
  return (
    (process.env.PULSE_ARTICLE_FETCH ?? "on").trim().toLowerCase() !== "off"
  );
}

/** PULSE_ARTICLE_FETCH_CONCURRENCY — parallel article fetches (default 5). */
function articleFetchConcurrency(): number {
  const raw = Number(process.env.PULSE_ARTICLE_FETCH_CONCURRENCY);
  return Number.isFinite(raw) && raw >= 1
    ? Math.floor(raw)
    : DEFAULT_CONCURRENCY;
}

/** Tiny bounded-concurrency worker pool — runs `fn` over `items`, at most
 *  `n` in flight, preserving index→result order. */
async function pool<T, R>(
  items: T[],
  n: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

/**
 * Enrich each row's `body` with extracted article text, in place.
 * Keeps the existing value (the outlet domain) whenever extraction
 * returns null. Logs a per-batch summary. Never throws.
 */
async function enrichBodies(rows: RawEventInput[]): Promise<void> {
  if (rows.length === 0) return;

  const concurrency = articleFetchConcurrency();
  let enriched = 0;
  let fellBack = 0;

  await pool(rows, concurrency, async (row) => {
    const url = row.sourceUrl;
    if (!url) {
      fellBack++;
      return;
    }
    let text: string | null = null;
    try {
      text = await extractArticleText(url);
    } catch {
      // extractArticleText never throws, but stay defensive: a bad URL
      // must not fail the whole ingest.
      text = null;
    }
    if (text) {
      row.body = text;
      enriched++;
    } else {
      fellBack++;
    }
  });

  console.log(
    `[gdelt] article enrichment: ${enriched} enriched / ${fellBack} fell back to domain name (of ${rows.length}) @ concurrency ${concurrency}`,
  );
}

export interface GdeltFetchResult {
  rows: RawEventInput[];
  unmatchedCountry: number;
  fetched: number;
}

export async function fetchGdelt(
  map: JurisdictionMap,
  opts: { hoursBack?: number } = {},
): Promise<GdeltFetchResult> {
  const hoursBack = opts.hoursBack ?? 24;

  let articles;
  try {
    articles = await fetchGdeltEvents(hoursBack);
  } catch (err) {
    // Surface the UNDERLYING cause — Node's fetch reports a bare
    // "fetch failed", but err.cause carries the real reason (ENOTFOUND,
    // ECONNRESET, a TLS error, an abort/timeout), which is what actually
    // tells us whether it's DNS, a WAF reset, or a slow endpoint.
    const e = err as Error & { cause?: unknown };
    const cause =
      e.cause instanceof Error
        ? `${e.cause.name}: ${e.cause.message}`
        : e.cause
          ? String(e.cause)
          : "(no cause)";
    throw new Error(`GDELT retrieval failed: ${e.message}; cause: ${cause}`);
  }

  const rows: RawEventInput[] = [];
  let unmatchedCountry = 0;

  for (const article of articles) {
    const rawCountry = article.sourcecountry?.trim();
    const jurisdictionId = resolveCountry(rawCountry, map);
    if (!jurisdictionId) {
      unmatchedCountry++;
    }

    const eventDate = parseArticleDate(article.seendate)
      .toISOString()
      .slice(0, 10);

    rows.push({
      sourceId: SOURCE_ID,
      externalId: article.url,
      sourceUrl: article.url,
      sourceType: "news",
      jurisdictionId,
      rawCountryName: rawCountry ?? null,
      eventDate,
      title: article.title,
      // Fallback body = outlet domain. Replaced with extracted article text
      // below when enrichment is enabled and the fetch succeeds.
      body: extractSourceName(article.domain),
      raw: article as unknown as Record<string, unknown>,
    });
  }

  // Best-effort body enrichment — never allowed to fail the ingest.
  if (articleFetchEnabled()) {
    try {
      await enrichBodies(rows);
    } catch (err) {
      console.warn(
        `[gdelt] article enrichment errored (kept domain fallbacks): ${(err as Error).message}`,
      );
    }
  }

  return { rows, unmatchedCountry, fetched: articles.length };
}
