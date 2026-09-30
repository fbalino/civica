import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import sitemap from "@/app/sitemap";
import { withCronJob } from "@/lib/api/cron-job";
import {
  pageRefreshOutcome,
  pageWarmTargets,
  refreshPages,
} from "@/lib/platform/page-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// No warm request starts after 560s and no verification request after 640s;
// a request times out after 45s, which leaves the cron boundary time to
// finalize.
export const maxDuration = 800;

/**
 * PLT-033 — runs daily at 10:00 UTC, after the bills (03:00–05:30), factbook
 * (01:00–06:30), and Pulse (08:00–09:00) jobs. It marks every cached page for
 * re-rendering, then requests each cacheable sitemap URL so the pages are
 * rebuilt now rather than on a crawler's first visit.
 *
 * Invalidation is repeatable, so a retry or duplicate run is harmless. A dry
 * run lists the warm-up targets without invalidating or requesting anything.
 */
async function handler(request: Request) {
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  // The sitemap throws when the configured database fails, so a missing
  // country list becomes a failed run rather than a partial warm-up.
  const targets = pageWarmTargets(await sitemap());
  const countryTargets = targets.filter((target) =>
    target.path.startsWith("/country/"),
  ).length;
  if (countryTargets === 0) {
    return NextResponse.json(
      {
        ok: false,
        outcome: "empty_result",
        step: "operations.refresh-pages",
        dryRun,
        rowsRead: targets.length,
      },
      { status: 500 },
    );
  }
  if (dryRun) {
    return NextResponse.json({
      ok: true,
      step: "operations.refresh-pages",
      dryRun,
      rowsRead: targets.length,
      countryTargets,
    });
  }

  revalidatePath("/", "layout");
  const result = await refreshPages(targets);
  const outcome = pageRefreshOutcome(result);
  if (result.skipped > 0) {
    console.warn(
      "[refresh-pages] warm-up budget reached " +
        JSON.stringify({ skipped: result.skipped, attempted: result.attempted }),
    );
  }
  if (outcome.pagesFailed > 0) {
    // Public URLs only; a failed page keeps serving its previous good copy.
    console.error(
      "[refresh-pages] pages not refreshed " +
        JSON.stringify({
          pagesFailed: outcome.pagesFailed,
          failureStatuses: result.failureStatuses,
          failedPaths: result.failedPaths,
        }),
    );
  }
  return NextResponse.json(
    {
      ok: outcome.ok,
      outcome: outcome.ok ? undefined : outcome.outcome,
      step: "operations.refresh-pages",
      dryRun,
      invalidated: "all-pages",
      rowsRead: result.targets,
      rowsWritten: result.warmed,
      rowsRejected: outcome.pagesFailed,
      pagesStaleAfterRefresh: result.staleAfterRefresh,
      pagesSkipped: result.skipped,
      pagesUnverified: result.unverified,
      countryTargets,
      failureStatuses: result.failureStatuses,
      failedPaths: result.failedPaths,
      durationSec: Math.round(result.durationMs / 1000),
    },
    { status: outcome.httpStatus },
  );
}

const cronHandler = withCronJob("operations.refresh-pages", handler);

export { cronHandler as GET, cronHandler as POST };
