/**
 * Reuters + AP wire feeds — combined connector.
 * License: news attribution.
 *
 * Two RSS feeds, fetched in parallel. Each item is tagged with the
 * appropriate sourceId (`reuters_wire` or `ap_wire`). Country
 * extraction relies on the title / description because wire feeds
 * don't tag country in the structured RSS schema.
 *
 * Both URLs are env-overrideable. The feeds may move (Reuters in
 * particular has rotated their public RSS endpoint a few times). An absent
 * URL is an explicit skip; once configured, retrieval and parsing failures
 * surface to the aggregate ingest instead of masquerading as a quiet feed.
 */

import { fetchRss, rssItemToEventDate } from "../rss";
import {
  extractCountryFromText,
  type JurisdictionMap,
} from "../country-resolver";
import type { RawEventInput } from "../types";

// Opt-in via env. The former hardcoded defaults are dead — Reuters retired
// its public agency RSS (404) and AP's feed host no longer resolves
// (ENOTFOUND) — so they fetched nothing but logged a failure every run.
// Left empty by default and skipped (like RSF/ACLED); set a working feed URL
// to re-enable.
const REUTERS_URL = process.env.REUTERS_RSS_URL ?? "";
const AP_URL = process.env.AP_RSS_URL ?? "";

export interface ReutersApFetchResult {
  rows: RawEventInput[];
  unmatchedCountry: number;
  fetched: number;
  reutersFetched: number;
  apFetched: number;
}

export interface ReutersApFetchOptions {
  /** Deterministic fixture/configuration seam. Omit to use the environment. */
  reutersUrl?: string | null;
  /** Deterministic fixture/configuration seam. Omit to use the environment. */
  apUrl?: string | null;
  fetchFeed?: typeof fetchRss;
}

async function fetchOne(
  url: string | null,
  sourceId: string,
  map: JurisdictionMap,
  fetchFeed: typeof fetchRss,
): Promise<{ rows: RawEventInput[]; unmatched: number; fetched: number }> {
  if (!url) {
    console.log(
      `[${sourceId}] no feed URL configured — skipping (set its *_RSS_URL to enable).`,
    );
    return { rows: [], unmatched: 0, fetched: 0 };
  }
  let items;
  try {
    items = await fetchFeed(url);
  } catch (err) {
    throw new Error(
      `${sourceId} feed retrieval failed (${url}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const rows: RawEventInput[] = [];
  let unmatched = 0;

  for (const item of items) {
    if (!item.title || !item.link) continue;
    // Try title first, then content snippet — wire stories often
    // mention the country in the lede.
    const matched =
      extractCountryFromText(item.title, map) ??
      extractCountryFromText(item.contentSnippet ?? "", map);
    const jurisdictionId = matched?.jurisdictionId ?? null;
    const rawCountryName = matched?.matched ?? null;
    if (!jurisdictionId) unmatched++;

    rows.push({
      sourceId,
      externalId: item.link,
      sourceUrl: item.link,
      sourceType: "news",
      jurisdictionId,
      rawCountryName,
      eventDate: rssItemToEventDate(item),
      title: item.title,
      body: item.contentSnippet ?? item.content ?? null,
      raw: item.raw,
    });
  }

  if (items.length > 0 && rows.length === 0) {
    throw new Error(
      `${sourceId} feed parsed ${items.length} upstream record${items.length === 1 ? "" : "s"} but produced no usable event rows`,
    );
  }

  return { rows, unmatched, fetched: items.length };
}

export async function fetchReutersAp(
  map: JurisdictionMap,
  opts: ReutersApFetchOptions = {},
): Promise<ReutersApFetchResult> {
  const reutersUrl = Object.hasOwn(opts, "reutersUrl")
    ? (opts.reutersUrl ?? null)
    : REUTERS_URL;
  const apUrl = Object.hasOwn(opts, "apUrl") ? (opts.apUrl ?? null) : AP_URL;
  const fetchFeed = opts.fetchFeed ?? fetchRss;
  const [reuters, ap] = await Promise.all([
    fetchOne(reutersUrl, "reuters_wire", map, fetchFeed),
    fetchOne(apUrl, "ap_wire", map, fetchFeed),
  ]);

  return {
    rows: [...reuters.rows, ...ap.rows],
    unmatchedCountry: reuters.unmatched + ap.unmatched,
    fetched: reuters.fetched + ap.fetched,
    reutersFetched: reuters.fetched,
    apFetched: ap.fetched,
  };
}
