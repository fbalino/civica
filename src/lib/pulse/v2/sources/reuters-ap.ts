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
 * particular has rotated their public RSS endpoint a few times).
 * Connector gracefully no-ops on 404.
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

async function fetchOne(
  url: string,
  sourceId: string,
  map: JurisdictionMap
): Promise<{ rows: RawEventInput[]; unmatched: number; fetched: number }> {
  if (!url) {
    console.log(
      `[${sourceId}] no feed URL configured — skipping (set its *_RSS_URL to enable).`
    );
    return { rows: [], unmatched: 0, fetched: 0 };
  }
  let items;
  try {
    items = await fetchRss(url);
  } catch (err) {
    console.warn(
      `[${sourceId}] feed fetch failed (${url}); returning 0 rows. ` +
        `Error: ${(err as Error).message}`
    );
    return { rows: [], unmatched: 0, fetched: 0 };
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

  return { rows, unmatched, fetched: items.length };
}

export async function fetchReutersAp(
  map: JurisdictionMap
): Promise<ReutersApFetchResult> {
  const [reuters, ap] = await Promise.all([
    fetchOne(REUTERS_URL, "reuters_wire", map),
    fetchOne(AP_URL, "ap_wire", map),
  ]);

  return {
    rows: [...reuters.rows, ...ap.rows],
    unmatchedCountry: reuters.unmatched + ap.unmatched,
    fetched: reuters.fetched + ap.fetched,
    reutersFetched: reuters.fetched,
    apFetched: ap.fetched,
  };
}
