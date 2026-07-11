/**
 * CIVICUS Monitor — civic-space alerts.
 * License: CC BY-SA 4.0
 *
 * CIVICUS publishes country-level civic-space ratings and alert posts.
 * The Monitor RSS feed surfaces recent alerts (restrictions on
 * assembly, expression, association). Country detection relies on
 * extracting the country from the title — most CIVICUS posts lead
 * with "[Country]:" or include the country in the headline.
 */

import { fetchRss, rssItemToEventDate } from "../rss";
import {
  extractCountryFromText,
  type JurisdictionMap,
} from "../country-resolver";
import type { RawEventInput } from "../types";

const FEED_URL =
  process.env.CIVICUS_RSS_URL ?? "https://monitor.civicus.org/feed/";

const SOURCE_ID = "civicus_monitor";

export interface CivicusFetchResult {
  rows: RawEventInput[];
  unmatchedCountry: number;
  fetched: number;
}

export async function fetchCivicus(
  map: JurisdictionMap,
): Promise<CivicusFetchResult> {
  const items = await fetchRss(FEED_URL);

  const rows: RawEventInput[] = [];
  let unmatchedCountry = 0;

  for (const item of items) {
    if (!item.title || !item.link) continue;

    const matched = extractCountryFromText(item.title, map);
    const jurisdictionId = matched?.jurisdictionId ?? null;
    const rawCountryName = matched?.matched ?? null;

    if (!jurisdictionId) {
      unmatchedCountry++;
    }

    rows.push({
      sourceId: SOURCE_ID,
      externalId: item.link, // CIVICUS doesn't expose stable post ids; URL is stable
      sourceUrl: item.link,
      sourceType: "specialist",
      jurisdictionId,
      rawCountryName,
      eventDate: rssItemToEventDate(item),
      title: item.title,
      body: item.contentSnippet ?? item.content ?? null,
      raw: item.raw,
    });
  }

  return { rows, unmatchedCountry, fetched: items.length };
}
