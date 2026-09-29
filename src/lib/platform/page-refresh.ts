import type { MetadataRoute } from "next";

import { isLivePagePath } from "@/lib/platform/cache-consistency";
import { SITE_URL } from "@/lib/site";

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
 */
export const PAGE_WARM_CONCURRENCY = 4;
export const PAGE_WARM_MIN_SLOT_MS = 2_000;
export const PAGE_WARM_REQUEST_TIMEOUT_MS = 45_000;
export const PAGE_WARM_BUDGET_MS = 640_000;
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
      url = new URL(entry.url);
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
  let next = 0;
  let attempted = 0;
  let warmed = 0;
  let failed = 0;

  const recordFailure = (key: string) => {
    failed += 1;
    failureStatuses[key] = (failureStatuses[key] ?? 0) + 1;
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
        if (response.status === 200) warmed += 1;
        else recordFailure(String(response.status));
      } catch (error) {
        recordFailure(
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
  };
}
