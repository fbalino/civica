const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";

// Base governance query terms (the "standard" scope).
const GOVERNANCE_TERMS_STANDARD = [
  "government",
  "parliament",
  "election",
  "coup",
  "protest",
  "reform",
  "constitutional",
  "military",
  "sanctions",
  "corruption",
];

// Additional terms activated only in the "wide" scope. Kept deliberately
// conservative — these are still governance-adjacent (not a generic news
// firehose), broadening recall for events the standard terms miss (judicial,
// press-freedom, and civil-liberties stories in particular).
const GOVERNANCE_TERMS_WIDE_EXTRA = [
  "judiciary",
  "supreme court",
  "referendum",
  "impeachment",
  "press freedom",
  "human rights",
  "state of emergency",
  "martial law",
];

/**
 * Ingest width knob — `PULSE_GDELT_SCOPE`:
 *   - "standard" (default): the base governance terms, 250 max records.
 *   - "wide": base + a conservative set of governance-adjacent terms and a
 *     higher record ceiling. This is a documented MULTIPLIER, not a
 *     firehose — the extra terms stay governance-scoped.
 *
 * Cost note: every extra ~1,000 raw events that survive clustering and
 * reach the paid classify path costs ≈ $0.59 in classify+verify tokens at
 * DeepSeek V4-Flash prices — computed from the research doc's token math
 * (~1,500 in + ~300 out per pass × 2 passes × $0.14/$0.28 per MTok; see
 * plan/pulse-classifier-cost-resolution-v1.md §2 and §4). "wide" roughly
 * doubles the record ceiling, so budget accordingly before enabling it in
 * production. Most extra records are deduped/clustered away, so the real
 * classify-cost delta is well below the raw-record delta.
 */
export type GdeltScope = "standard" | "wide";

export function resolveGdeltScope(): GdeltScope {
  return (process.env.PULSE_GDELT_SCOPE ?? "").trim().toLowerCase() === "wide"
    ? "wide"
    : "standard";
}

function governanceTermsFor(scope: GdeltScope): string {
  const terms =
    scope === "wide"
      ? [...GOVERNANCE_TERMS_STANDARD, ...GOVERNANCE_TERMS_WIDE_EXTRA]
      : GOVERNANCE_TERMS_STANDARD;
  // GDELT treats a bare space as OR inside a parenthesized group, but
  // multi-word phrases must be quoted so they match as a phrase.
  return terms.map((t) => (t.includes(" ") ? `"${t}"` : t)).join(" OR ");
}

// GDELT's DOC API hard-caps `maxrecords` at 250 per request, so "wide"
// cannot raise the per-request ceiling. Instead it broadens recall two
// documented, bounded ways: (1) a wider governance-term set (above), and
// (2) a longer look-back window per fetch (LOOKBACK_MULTIPLIER), which
// surfaces governance events the 24h standard window would miss without
// resorting to a firehose. The multiplier is intentionally small (2×).
const GDELT_MAX_RECORDS = 250;
const WIDE_LOOKBACK_MULTIPLIER = 2;

export interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  sourcecountry: string;
  language: string;
  socialimage?: string;
}

export interface GdeltResponse {
  articles: GdeltArticle[];
}

function formatGdeltDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace("T", "").slice(0, 14);
}

export async function fetchGdeltEvents(hoursBack = 24): Promise<GdeltArticle[]> {
  const scope = resolveGdeltScope();
  const effectiveHoursBack =
    scope === "wide" ? hoursBack * WIDE_LOOKBACK_MULTIPLIER : hoursBack;

  const now = new Date();
  const start = new Date(now.getTime() - effectiveHoursBack * 60 * 60 * 1000);

  const params = new URLSearchParams({
    query: `(${governanceTermsFor(scope)})`,
    mode: "artlist",
    format: "json",
    maxrecords: String(GDELT_MAX_RECORDS),
    startdatetime: formatGdeltDate(start),
    enddatetime: formatGdeltDate(now),
  });

  const url = `${GDELT_DOC_API}?${params.toString()}`;
  // GDELT can be slow to respond from some networks; allow 60s per try.
  // Retry on transient connect failures AND on rate-limit / temporary
  // server responses (429/503) — GDELT frequently answers 429 for a few
  // seconds when polled, and without a retry the daily refresh loses its
  // highest-volume source for the whole day.
  const res = await fetchWithRetry(url, { signal: AbortSignal.timeout(60_000) });

  if (!res.ok) {
    throw new Error(`GDELT API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as GdeltResponse;
  return data.articles ?? [];
}

/** HTTP statuses worth retrying with backoff — rate limit + transient
 *  upstream errors. A 429 is returned as a non-ok Response (fetch does
 *  not throw on it), so it must be handled here, not only in catch. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  attempts = 4
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      // Retry rate-limit / transient upstream statuses with backoff.
      if (RETRYABLE_STATUS.has(res.status) && i < attempts - 1) {
        // Honour Retry-After when GDELT sends it; otherwise exponential
        // backoff starting at 2s (2s, 4s, 8s) — well within a routine's
        // budget and respectful of GDELT's short rate-limit window.
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 15_000)
          : 2000 * 2 ** i;
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
      }
    }
  }
  if (lastErr) throw lastErr;
  // All attempts returned a retryable status — do the final fetch so the
  // caller sees the real (non-ok) response and its status in the error.
  return fetch(url, init);
}

export function parseArticleDate(seendate: string): Date {
  // GDELT seendate format: "20240101T123456Z" or "20240101000000"
  const cleaned = seendate.replace(/[TZ]/g, "").padEnd(14, "0");
  const year = parseInt(cleaned.slice(0, 4));
  const month = parseInt(cleaned.slice(4, 6)) - 1;
  const day = parseInt(cleaned.slice(6, 8));
  const hour = parseInt(cleaned.slice(8, 10));
  const min = parseInt(cleaned.slice(10, 12));
  const sec = parseInt(cleaned.slice(12, 14));
  return new Date(Date.UTC(year, month, day, hour, min, sec));
}

export function extractSourceName(domain: string): string {
  return domain.replace(/^www\./, "");
}
