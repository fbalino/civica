import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import sitemap from "@/app/sitemap";
import { withCronJob } from "@/lib/api/cron-job";
import { pageWarmTargets, refreshPages } from "@/lib/platform/page-refresh";
import {
  parsePageRebuildForce,
  runPageRebuild,
} from "@/lib/platform/page-rebuild";
import {
  readCurrentPageFingerprints,
  readStoredPageFingerprints,
  storePageFingerprints,
} from "@/lib/platform/page-fingerprints";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// No warm request starts after 560s and no verification request after 640s;
// a request times out after 45s, which leaves the cron boundary time to
// finalize.
export const maxDuration = 800;

/**
 * PLT-033 / APR-D179 — runs nightly at 07:00 UTC (04:00 in Uruguay), after
 * the nightly imports. It fingerprints the database content each cached page
 * group renders, compares it with the fingerprint stored at that group's
 * last successful rebuild, and rebuilds only the groups that changed: a
 * changed country's three tabs, and the non-country pages when anything
 * changed. Pages are never rebuilt per visit, and unchanged pages are never
 * rewritten into the page cache.
 *
 * A group's new fingerprint is stored only after all of its pages were
 * re-rendered and verified, so a failed group is retried the next night.
 * `?dryRun=1` lists what would be rebuilt without invalidating, requesting,
 * or storing anything. `?force=all` or `?force=<slug>[,<slug>]` rebuilds
 * those groups even when unchanged.
 */
async function handler(request: Request) {
  const params = new URL(request.url).searchParams;
  // The sitemap throws when the configured database fails, so a missing
  // country list becomes a failed run rather than a partial warm-up.
  const targets = pageWarmTargets(await sitemap());
  const run = await runPageRebuild({
    targets,
    origin: new URL(SITE_URL).origin,
    dryRun: params.get("dryRun") === "1",
    force: parsePageRebuildForce(params.get("force")),
    deps: {
      readCurrent: readCurrentPageFingerprints,
      readStored: readStoredPageFingerprints,
      store: storePageFingerprints,
      revalidate: (path) => revalidatePath(path),
      refresh: (selected) => refreshPages(selected),
    },
  });
  return NextResponse.json(run.body, { status: run.status });
}

const cronHandler = withCronJob("operations.refresh-pages", handler);

export { cronHandler as GET, cronHandler as POST };
