/**
 * Firecrawl fallback for publishers that block direct retrieval.
 *
 * Some publishers front their site with a bot/WAF layer that refuses our
 * ingestion regardless of user agent — Amnesty International returns HTTP 403
 * to every request for its whole domain, from both this project's servers and
 * ordinary machines. That is a retrieval problem, not a rights problem: the
 * feed is public, freely readable in a browser, and already inside the source
 * set the project ingests under its recorded terms.
 *
 * This module retrieves the SAME public URL through Firecrawl and returns the
 * raw bytes, so the normal parser and the normal provenance record apply
 * unchanged. It is deliberately a FALLBACK: callers try the direct fetch
 * first and only spend a Firecrawl credit when the publisher blocked them.
 *
 * Absent `FIRECRAWL_API_KEY` this module does nothing and the caller's
 * original failure stands — a blocked feed keeps failing honestly rather than
 * silently disappearing from the run.
 */

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

/** Retrieve a public URL's raw body through Firecrawl. */
export async function firecrawlRawFetch(
  url: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<string> {
  const key = (process.env.FIRECRAWL_API_KEY ?? "").trim();
  if (!key) throw new Error("FIRECRAWL_API_KEY is not configured");

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
