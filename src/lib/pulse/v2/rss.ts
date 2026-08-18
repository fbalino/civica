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
import { publisherFallbackDecision } from "./publisher-fallback-permission";

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
 * International refuses its whole domain to any user agent), the same public
 * URL is retried through Firecrawl ONLY when that publisher's recorded
 * permission state is `granted` (`publisher-fallback-permission/v1`).
 * Everything else — an unregistered host, a request still pending, a refusal,
 * or a missing key — leaves the publisher's own error standing, with the
 * reason logged so the cause of a failing feed is visible in the run log.
 *
 * When the fallback does run, the parser, provenance record, and rights
 * handling are unchanged; only the transport differs. Ordinary failures
 * (timeout, 5xx) are never retried, so a publisher having a bad day costs
 * nothing.
 */
export async function fetchRss(url: string): Promise<RssItem[]> {
  const parser = getParser();
  let feed;
  try {
    feed = await parser.parseURL(url);
  } catch (error) {
    if (!isPublisherBlock(error)) throw error;

    const decision = publisherFallbackDecision(url);
    if (!decision.allowed) {
      console.warn(
        `[rss] ${url} blocked by publisher; fallback NOT used: ${decision.reason}`,
      );
      throw error;
    }
    if (!firecrawlConfigured()) {
      console.warn(
        `[rss] ${url} blocked by publisher; fallback permitted but FIRECRAWL_API_KEY is not configured`,
      );
      throw error;
    }
    console.warn(
      `[rss] ${url} blocked by publisher; retrieving via Firecrawl fallback (${decision.reason})`,
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
