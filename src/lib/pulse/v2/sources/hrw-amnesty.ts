/**
 * Human Rights Watch + Amnesty International — combined connector.
 * License: attribution required (both).
 *
 * Both organisations publish daily reports of human-rights violations
 * worldwide. Each gets its own row in `sources` (`hrw`, `amnesty`). The
 * current heuristic counts distinct source IDs; it does not establish
 * source-family independence or detect republication.
 */

import { fetchRss, rssItemToEventDate } from "../rss";
import {
  extractCountryFromText,
  type JurisdictionMap,
} from "../country-resolver";
import type { RawEventInput } from "../types";
import { directRetrievalPermitted } from "../publisher-fallback-permission";

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
  map: JurisdictionMap,
): Promise<{ rows: RawEventInput[]; unmatched: number; fetched: number }> {
  const items = await fetchRss(url);

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

export async function fetchHrw(map: JurisdictionMap) {
  const result = await fetchOne(HRW_URL, "hrw", map);
  return {
    rows: result.rows,
    unmatchedCountry: result.unmatched,
    fetched: result.fetched,
  };
}

/**
 * Amnesty is a RECORDED NON-RETRIEVAL, not a broken connector.
 *
 * Amnesty's Terms of Use (revised 2026-08-13) forbid automated access to
 * their site without their permission, and separately forbid evading their
 * access controls. Their edge also 403s us. Civica's owner decided
 * (2026-08-18) to request permission rather than retrieve, so this connector
 * makes NO REQUEST at all while permission is absent — declining to ask is
 * the point, and a request we believe is disallowed should not be sent even
 * once. It reports a legitimate skip (`ran: false`, zero rows, no error),
 * exactly like an unconfigured optional connector, so ingest stays honest
 * rather than recording a failure Civica chose.
 *
 * Flip `amnesty.org` to `granted` in PUBLISHER_DIRECT_RETRIEVAL, with the
 * permission evidence, to switch this back on.
 */
export async function fetchAmnesty(map: JurisdictionMap) {
  const permission = directRetrievalPermitted(AMNESTY_URL);
  if (!permission.permitted) {
    console.warn(
      `[ingest:amnesty] not retrieved — automated access requires the publisher's permission: ${permission.reason}`,
    );
    return { rows: [], unmatchedCountry: 0, fetched: 0, ran: false };
  }
  const result = await fetchOne(AMNESTY_URL, "amnesty", map);
  return {
    rows: result.rows,
    unmatchedCountry: result.unmatched,
    fetched: result.fetched,
    ran: true,
  };
}

export async function fetchHrwAmnesty(
  map: JurisdictionMap,
): Promise<HrwAmnestyFetchResult> {
  // Fan out both separately identified feeds in parallel.
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
