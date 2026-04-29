/**
 * Reporters Without Borders (RSF) — press freedom alerts.
 * License: attribution required.
 *
 * As of 2026-04, RSF does not publish a public RSS/Atom feed at any
 * standard path on rsf.org. The connector remains in place against
 * a configurable env override so we can plug in the right ingestion
 * surface (likely an API contact) when established. Until then, the
 * connector gracefully returns 0 rows — the schema, scoring, and
 * corroboration pipeline are all RSF-ready when the data turns on.
 *
 * Set `RSF_RSS_URL` to enable, OR replace this connector body with
 * the proper API client when we have the licensing/auth path.
 */

import { fetchRss, rssItemToEventDate } from "../rss";
import {
  extractCountryFromText,
  type JurisdictionMap,
} from "../country-resolver";
import type { RawEventInput } from "../types";

const FEED_URL = process.env.RSF_RSS_URL ?? null;

const SOURCE_ID = "rsf_alerts";

export interface RsfFetchResult {
  rows: RawEventInput[];
  unmatchedCountry: number;
  fetched: number;
}

export async function fetchRsf(map: JurisdictionMap): Promise<RsfFetchResult> {
  if (!FEED_URL) {
    console.info(
      "[rsf] RSF_RSS_URL not set — skipping (no public feed available as of 2026-04)."
    );
    return { rows: [], unmatchedCountry: 0, fetched: 0 };
  }

  let items;
  try {
    items = await fetchRss(FEED_URL);
  } catch (err) {
    console.warn(
      `[rsf] feed fetch failed (${FEED_URL}); returning 0 rows. ` +
        `Error: ${(err as Error).message}`
    );
    return { rows: [], unmatchedCountry: 0, fetched: 0 };
  }

  const rows: RawEventInput[] = [];
  let unmatchedCountry = 0;

  for (const item of items) {
    if (!item.title || !item.link) continue;

    // RSF posts often lead with the country: "Iran: 14 journalists detained..."
    // Title-only matching is sufficient.
    const matched = extractCountryFromText(item.title, map);
    const jurisdictionId = matched?.jurisdictionId ?? null;
    const rawCountryName = matched?.matched ?? null;

    if (!jurisdictionId) {
      unmatchedCountry++;
    }

    rows.push({
      sourceId: SOURCE_ID,
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

  return { rows, unmatchedCountry, fetched: items.length };
}
