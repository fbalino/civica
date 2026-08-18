/**
 * Firecrawl fallback for publishers that block direct retrieval.
 *
 * Some publishers front their site with a bot/WAF layer that refuses our
 * ingestion regardless of user agent — Amnesty International returns HTTP 403
 * to every request for its whole domain, from both this project's servers and
 * ordinary machines.
 *
 * Retrieving the SAME public URL through another network is nonetheless a
 * different act from fetching an open feed, so this module does it only where
 * Civica holds a recorded permission from that publisher. The gate is
 * `publisher-fallback-permission/v1`: an unregistered host, a pending request,
 * and a refusal all behave exactly as if no Firecrawl key existed. Permission
 * is checked here as well as in the caller, so a future call site cannot
 * acquire the fallback by forgetting to ask.
 *
 * When permission does exist the retrieved bytes go to the normal parser, so
 * the normal provenance record and rights handling apply unchanged. It is
 * deliberately a FALLBACK: callers try the direct fetch first and only spend a
 * Firecrawl credit when the publisher blocked them.
 *
 * Absent `FIRECRAWL_API_KEY` this module does nothing and the caller's
 * original failure stands — a blocked feed keeps failing honestly rather than
 * silently disappearing from the run.
 */

import {
  publisherFallbackDecision,
  type PublisherFallbackPermission,
} from "./publisher-fallback-permission";

const FIRECRAWL_ENDPOINT =
  process.env.FIRECRAWL_API_URL ?? "https://api.firecrawl.dev/v2/scrape";

export function firecrawlConfigured(): boolean {
  return (process.env.FIRECRAWL_API_KEY ?? "").trim().length > 0;
}

/**
 * True when an error looks like a publisher-side block rather than an
 * ordinary transport failure. Narrow on purpose: a timeout or a 500 is the
 * publisher having a bad day and should NOT burn a credit on retry.
 */
export function isPublisherBlock(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(403|401|429)\b|forbidden|access denied|blocked/i.test(message);
}

/**
 * Retrieve a public URL's raw body through Firecrawl.
 *
 * Refuses unless the host's recorded permission state is `granted`, so the
 * publisher-permission rule holds for every caller, not just the ones that
 * remember to check.
 */
export async function firecrawlRawFetch(
  url: string,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    /** Test seam. Production always uses the checked-in registry. */
    permissions?: readonly PublisherFallbackPermission[];
  } = {},
): Promise<string> {
  const key = (process.env.FIRECRAWL_API_KEY ?? "").trim();
  if (!key) throw new Error("FIRECRAWL_API_KEY is not configured");

  const decision = publisherFallbackDecision(url, options.permissions);
  if (!decision.allowed) {
    throw new Error(
      `Firecrawl fallback is not permitted for ${url}: ${decision.reason}`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 60_000,
  );
  try {
    const response = await (options.fetchImpl ?? fetch)(FIRECRAWL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Firecrawl retrieval failed for ${url}: HTTP ${response.status}`,
      );
    }
    const payload = (await response.json()) as {
      success?: boolean;
      data?: { rawHtml?: unknown };
    };
    const raw = payload.data?.rawHtml;
    if (payload.success === false || typeof raw !== "string" || !raw.trim()) {
      throw new Error(`Firecrawl returned no content for ${url}`);
    }
    return raw;
  } finally {
    clearTimeout(timer);
  }
}
