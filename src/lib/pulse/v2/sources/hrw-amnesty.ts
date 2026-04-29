/**
 * Human Rights Watch + Amnesty International — combined connector.
 * License: attribution required (both).
 *
 * Both organisations publish daily reports of human-rights violations
 * worldwide. Each gets its own row in `sources` (`hrw`, `amnesty`)
 * because corroboration confidence treats them as independent.
 */

import { fetchRss, rssItemToEventDate } from "../rss";
import {
  extractCountryFromText,
  type JurisdictionMap,
} from "../country-resolver";
import type { RawEventInput } from "../types";

const HRW_URL = process.env.HRW_RSS_URL ?? "https://www.hrw.org/rss/news";
const AMNESTY_URL =
  process.env.AMNESTY_RSS_URL ?? "https://www.amnesty.org/en/feed/";

export interface HrwAmnestyFetchResult {
  rows: RawEventInput[];
  unmatchedCountry: number;
  fetched: number;
  hrwFetched: number;
  amnestyFetched: number;
}

async function fetchOne(
  url: string,
  sourceId: string,
  map: JurisdictionMap
): Promise<{ rows: RawEventInput[]; unmatched: number; fetched: number }> {
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
    const matched = extractCountryFromText(item.title, map);
    const jurisdictionId = matched?.jurisdictionId ?? null;
    const rawCountryName = matched?.matched ?? null;
    if (!jurisdictionId) unmatched++;

    rows.push({
      sourceId,
      externalId: item.link,
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

  return { rows, unmatched, fetched: items.length };
}

export async function fetchHrwAmnesty(
  map: JurisdictionMap
): Promise<HrwAmnestyFetchResult> {
  // Fan out both fetches in parallel — independent feeds.
  const [hrw, amnesty] = await Promise.all([
    fetchOne(HRW_URL, "hrw", map),
    fetchOne(AMNESTY_URL, "amnesty", map),
  ]);

  return {
    rows: [...hrw.rows, ...amnesty.rows],
    unmatchedCountry: hrw.unmatched + amnesty.unmatched,
    fetched: hrw.fetched + amnesty.fetched,
    hrwFetched: hrw.fetched,
    amnestyFetched: amnesty.fetched,
  };
}
