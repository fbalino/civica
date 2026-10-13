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
  forgetPageFingerprints,
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
 * the nightly imports. It fingerprints the database content each country's
 * three tabs render, compares it with the fingerprint stored at that
 * country's last successful rebuild, and rebuilds only the countries that
 * changed. The roughly 70 non-country pages read too many tables to
 * fingerprint safely, so they are rebuilt every night. Pages are never
 * rebuilt per visit, and unchanged country pages are never rewritten into
 * the page cache.
 *
 * A country's new fingerprint is stored only after all of its pages were
 * re-rendered and verified, so a failed country is retried the next night.
 * `?dryRun=1` lists what would be rebuilt without invalidating, requesting,
 * or storing anything. `?force=all` rebuilds every page;
 * `?force=<slug>[,<slug>]` rebuilds only those countries.
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
      forget: forgetPageFingerprints,
      revalidate: (path) => revalidatePath(path),
      refresh: (selected) => refreshPages(selected),
    },
  });
  return NextResponse.json(run.body, { status: run.status });
}

const cronHandler = withCronJob("operations.refresh-pages", handler);

export { cronHandler as GET, cronHandler as POST };
