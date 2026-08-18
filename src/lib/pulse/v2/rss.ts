/**
 * Phase 5.5 — thin wrapper around `rss-parser` for the Pulse Beta
 * connectors. Most specialist feeds (CIVICUS, RSF, HRW, Amnesty)
 * publish RSS 2.0; some publish Atom. `rss-parser` handles both.
 */

import Parser from "rss-parser";
import {
  firecrawlConfigured,
  firecrawlRawFetch,
  isPublisherBlock,
} from "./firecrawl-fetch";

export interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  /** Per-feed extra fields the connectors can pull out of `raw` */
  raw: Record<string, unknown>;
}

let parserCache: Parser | null = null;

function getParser(): Parser {
  if (parserCache) return parserCache;
  parserCache = new Parser({
    timeout: 20_000,
    headers: {
      "User-Agent":
        "Civica/1.0 (Pulse Beta ingestion; +https://civicaatlas.org)",
    },
  });
  return parserCache;
}

/**
 * Fetch + parse an RSS/Atom feed. Returns normalised items.
 *
 * Direct retrieval first. If the publisher BLOCKS us (403/401/429 — Amnesty
 * International refuses its whole domain to any user agent), retry the same
 * public URL through Firecrawl and parse the identical bytes. Everything
 * downstream — parser, provenance, rights record — is unchanged; only the
 * transport differs. Ordinary failures (timeout, 5xx) are not retried, so a
 * publisher having a bad day costs nothing.
 */
export async function fetchRss(url: string): Promise<RssItem[]> {
  const parser = getParser();
  let feed;
  try {
    feed = await parser.parseURL(url);
  } catch (error) {
    if (!isPublisherBlock(error) || !firecrawlConfigured()) throw error;
    console.warn(
      `[rss] ${url} blocked by publisher; retrieving via Firecrawl fallback`,
    );
    feed = await parser.parseString(await firecrawlRawFetch(url));
  }
  return (feed.items ?? []).map((item) => ({
    title: (item.title ?? "").trim(),
    link: (item.link ?? "").trim(),
    pubDate: item.pubDate,
    isoDate: item.isoDate,
    contentSnippet: item.contentSnippet,
    content: item.content,
    raw: item as unknown as Record<string, unknown>,
  }));
}

/** Convert an RSS pubDate / isoDate to YYYY-MM-DD or null. */
export function rssItemToEventDate(item: RssItem): string | null {
  const raw = item.isoDate ?? item.pubDate;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
