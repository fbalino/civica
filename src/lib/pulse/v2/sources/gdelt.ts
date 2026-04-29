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
 * weighted lower and held to stricter rules in low-press-freedom
 * countries — that logic lives in `corroborate.ts`, not here.
 */

import {
  fetchGdeltEvents,
  parseArticleDate,
  extractSourceName,
} from "../../gdelt";
import {
  resolveCountry,
  type JurisdictionMap,
} from "../country-resolver";
import type { RawEventInput } from "../types";

const SOURCE_ID = "gdelt";

export interface GdeltFetchResult {
  rows: RawEventInput[];
  unmatchedCountry: number;
  fetched: number;
}

export async function fetchGdelt(
  map: JurisdictionMap,
  opts: { hoursBack?: number } = {}
): Promise<GdeltFetchResult> {
  const hoursBack = opts.hoursBack ?? 24;

  let articles;
  try {
    articles = await fetchGdeltEvents(hoursBack);
  } catch (err) {
    console.warn(`[gdelt] fetch failed: ${(err as Error).message}`);
    return { rows: [], unmatchedCountry: 0, fetched: 0 };
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
      body: extractSourceName(article.domain),
      raw: article as unknown as Record<string, unknown>,
    });
  }

  return { rows, unmatchedCountry, fetched: articles.length };
}
