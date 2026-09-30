import type { MetadataRoute } from "next";

import { isLivePagePath } from "@/lib/platform/cache-consistency";
import { SITE_URL } from "@/lib/site";
import { unescapeSitemapUrl } from "@/lib/seo/sitemap-xml";

/**
 * PLT-033 — daily page refresh.
 *
 * `operations.refresh-pages` invalidates the whole page cache once the day's
 * imports have finished, then requests every cacheable sitemap URL so the
 * database does its rendering in one bounded window instead of whenever a
 * crawler first arrives.
 *
 * Vercel serves an invalidated page stale and re-renders it in the
 * background, so a warm request can return before its render finishes. Each
 * worker therefore spends at least `PAGE_WARM_MIN_SLOT_MS` per URL: at most
 * two page renders start per second whichever way the platform behaves,
 * which keeps the 0.25-CU database and the 600-per-minute firewall ceiling
 * well clear. A time budget stops new requests early enough for the job to
 * finish inside its function limit; any URL left over is still invalidated
 * and renders on its next visit.
 *
 * Any non-200 response is a failure the job reports. Because a background
 * re-render happens after the warm request has already received the stale
 * copy, a page answered `STALE` is requested once more after the first pass:
 * a second `STALE` means its re-render failed (for example, a database read
 * threw), so Next.js is still serving the previous good page. That is also
 * reported as a failure.
 */
export const PAGE_WARM_CONCURRENCY = 4;
export const PAGE_WARM_MIN_SLOT_MS = 2_000;
export const PAGE_WARM_REQUEST_TIMEOUT_MS = 45_000;
export const PAGE_WARM_BUDGET_MS = 560_000;
/** Verification requests are served from cache, so they are paced faster. */
export const PAGE_VERIFY_MIN_SLOT_MS = 250;
/** No verification request starts after this point of the run. */
export const PAGE_REFRESH_TOTAL_BUDGET_MS = 640_000;
export const PAGE_WARM_USER_AGENT = "CivicaPageRefresh/1.0";

export interface PageWarmTarget {
  url: string;
  path: string;
  priority: number;
}

export interface PageWarmResult {
  targets: number;
  attempted: number;
  warmed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failureStatuses: Record<string, number>;
  /** Targets answered from a stale cache entry while it re-renders. */
  staleTargets: PageWarmTarget[];
  /** Paths of failed requests, bounded for the run report. */
  failedPaths: string[];
}

const MAX_REPORTED_PATHS = 25;

function cacheStatus(response: Response): string {
  return (
    response.headers.get("x-vercel-cache") ??
    response.headers.get("x-nextjs-cache") ??
    ""
  ).toUpperCase();
}

/**
 * Select the sitemap URLs that the page cache can serve: same origin, no
 * query string, and not a request-live page. Higher sitemap priority warms
 * first so a budget stop leaves only the least important pages cold.
 */
export function pageWarmTargets(
  entries: MetadataRoute.Sitemap,
  origin: string = SITE_URL,
): PageWarmTarget[] {
  const canonical = new URL(origin).origin;
  const byPath = new Map<string, PageWarmTarget>();
  for (const entry of entries) {
    let url: URL;
    try {
      // The sitemap escapes its URLs for XML; request the real URL.
      url = new URL(unescapeSitemapUrl(entry.url));
    } catch {
      continue;
    }
    if (url.origin !== canonical || url.search || url.hash) continue;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (isLivePagePath(path)) continue;
    const priority =
      typeof entry.priority === "number" && Number.isFinite(entry.priority)
        ? entry.priority
        : 0.5;
    const existing = byPath.get(path);
    if (!existing || existing.priority < priority) {
      byPath.set(path, { url: `${canonical}${path}`, path, priority });
    }
  }
  return [...byPath.values()].sort(
    (left, right) =>
      right.priority - left.priority || left.path.localeCompare(right.path),
  );
}

export interface PageWarmOptions {
  fetcher?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  concurrency?: number;
  minSlotMs?: number;
  requestTimeoutMs?: number;
  budgetMs?: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Request each target with bounded concurrency, pacing, per-request timeout,
 * and an overall budget. The response body is read to the end so a blocking
 * render is not cancelled. Redirects are not followed; any non-200 status is
 * a failure.
 */
export async function warmPages(
  targets: readonly PageWarmTarget[],
  options: PageWarmOptions = {},
): Promise<PageWarmResult> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? defaultSleep;
  const concurrency = Math.max(1, options.concurrency ?? PAGE_WARM_CONCURRENCY);
  const minSlotMs = Math.max(0, options.minSlotMs ?? PAGE_WARM_MIN_SLOT_MS);
  const requestTimeoutMs =
    options.requestTimeoutMs ?? PAGE_WARM_REQUEST_TIMEOUT_MS;
  const budgetMs = options.budgetMs ?? PAGE_WARM_BUDGET_MS;
  const startedAt = now();
  const failureStatuses: Record<string, number> = {};
  const staleTargets: PageWarmTarget[] = [];
  const failedPaths: string[] = [];
  let next = 0;
  let attempted = 0;
  let warmed = 0;
  let failed = 0;

  const recordFailure = (target: PageWarmTarget, key: string) => {
    failed += 1;
    failureStatuses[key] = (failureStatuses[key] ?? 0) + 1;
    if (failedPaths.length < MAX_REPORTED_PATHS) failedPaths.push(target.path);
  };

  const worker = async () => {
    while (next < targets.length) {
      if (now() - startedAt >= budgetMs) return;
      const target = targets[next++]!;
      attempted += 1;
      const slotStartedAt = now();
      try {
        const response = await fetcher(target.url, {
          method: "GET",
          headers: { "user-agent": PAGE_WARM_USER_AGENT },
          cache: "no-store",
          redirect: "manual",
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        await response.arrayBuffer();
        if (response.status === 200) {
          warmed += 1;
          if (cacheStatus(response) === "STALE") staleTargets.push(target);
        } else {
          recordFailure(target, String(response.status));
        }
      } catch (error) {
        recordFailure(
          target,
          error instanceof Error && error.name === "TimeoutError"
            ? "timeout"
            : "network",
        );
      }
      const remaining = minSlotMs - (now() - slotStartedAt);
      if (remaining > 0) await sleep(remaining);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, targets.length) }, worker),
  );
  return {
    targets: targets.length,
    attempted,
    warmed,
    failed,
    skipped: targets.length - attempted,
    durationMs: now() - startedAt,
    failureStatuses,
    staleTargets,
    failedPaths,
  };
}

export interface PageRefreshReport {
  targets: number;
  attempted: number;
  warmed: number;
  /** Non-200 responses, timeouts, and network errors in either pass. */
  failed: number;
  /** Pages still answered STALE on the verification pass. */
  staleAfterRefresh: number;
  skipped: number;
  unverified: number;
  durationMs: number;
  failureStatuses: Record<string, number>;
  failedPaths: string[];
}

/**
 * Warm every target, then re-request the ones answered STALE so a failed
 * background re-render is counted instead of silently leaving yesterday's
 * page in place.
 */
export async function refreshPages(
  targets: readonly PageWarmTarget[],
  options: PageWarmOptions & { totalBudgetMs?: number } = {},
): Promise<PageRefreshReport> {
  const now = options.now ?? (() => Date.now());
  const startedAt = now();
  const warm = await warmPages(targets, options);
  const remaining =
    (options.totalBudgetMs ?? PAGE_REFRESH_TOTAL_BUDGET_MS) - (now() - startedAt);
  const verify =
    warm.staleTargets.length > 0 && remaining > 0
      ? await warmPages(warm.staleTargets, {
          ...options,
          minSlotMs: PAGE_VERIFY_MIN_SLOT_MS,
          budgetMs: remaining,
        })
      : null;
  const failureStatuses = { ...warm.failureStatuses };
  for (const [key, count] of Object.entries(verify?.failureStatuses ?? {})) {
    failureStatuses[key] = (failureStatuses[key] ?? 0) + count;
  }
  const staleAfterRefresh = verify?.staleTargets.length ?? 0;
  if (staleAfterRefresh > 0) failureStatuses.stale = staleAfterRefresh;
  const failedPaths = [
    ...warm.failedPaths,
    ...(verify?.failedPaths ?? []),
    ...(verify?.staleTargets.map((target) => target.path) ?? []),
  ].slice(0, MAX_REPORTED_PATHS);
  return {
    targets: warm.targets,
    attempted: warm.attempted,
    warmed: warm.warmed - (verify?.failed ?? 0) - staleAfterRefresh,
    failed: warm.failed + (verify?.failed ?? 0),
    staleAfterRefresh,
    skipped: warm.skipped,
    unverified: verify ? verify.skipped : warm.staleTargets.length,
    durationMs: now() - startedAt,
    failureStatuses,
    failedPaths,
  };
}

/** A run fails when more than this share of attempted pages did not refresh. */
export const PAGE_REFRESH_MAX_FAILURE_RATE = 0.01;

/**
 * Every failed page is counted and reported. The run itself fails (HTTP 502,
 * a non-retryable outcome) when no page refreshed or more than 1% of the
 * attempted pages did not, so `operations.pipeline-alerts` raises it.
 */
export function pageRefreshOutcome(report: PageRefreshReport): {
  ok: boolean;
  outcome: "completed" | "warm_unavailable" | "pages_not_refreshed";
  httpStatus: 200 | 502;
  pagesFailed: number;
} {
  const pagesFailed = report.failed + report.staleAfterRefresh;
  if (report.attempted > 0 && report.warmed <= 0) {
    return { ok: false, outcome: "warm_unavailable", httpStatus: 502, pagesFailed };
  }
  if (
    report.attempted > 0 &&
    pagesFailed / report.attempted > PAGE_REFRESH_MAX_FAILURE_RATE
  ) {
    return { ok: false, outcome: "pages_not_refreshed", httpStatus: 502, pagesFailed };
  }
  return { ok: true, outcome: "completed", httpStatus: 200, pagesFailed };
}
