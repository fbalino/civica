/**
 * Phase R.8 — FAO FAOSTAT sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET` (per
 * the shared cron boundary). 4 indicators sliced from a single bulk-download
 * pass over the FAO Land Use (RL) ZIP archive (~3 MB compressed).
 * Total wall time is dominated by upserts (~840 rows) plus the in-
 * memory CSV parse; expect ~30–60s on a warm DB.
 *
 * **Bulk-download architecture.** Per resolution §2a, R.8 fetches the
 * keyless bulk-download ZIP from `bulks-faostat.fao.org` rather than
 * paging the REST API at `faostatservices.fao.org/api/v1/en/` (which
 * requires an Authorization header verified live 2026-05-04 returning
 * HTTP 401). Single-request architecture matches Civica's keyless
 * cron preference.
 *
 * **All 4 indicators canonical.** FAO is the upstream-canonical
 * publisher for agriculture-, forestry-, and land-use-specific
 * indicators; WB's `AG.LND.AGRI.ZS` and OECD's ENV-AGRI dataflow both
 * republish FAO without methodological adjustment. Per resolution
 * §2d.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.8
 * Resolution:  ~/civica/plan/fao-faostat-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { syncFaoFaostat } from "@/lib/factbook/reconcile/sync-fao-faostat";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();

  const summary = await syncFaoFaostat(db, {
    dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
    // Cron always runs a full pass over all 4 FAO indicators.
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
    },
  });
  assertExternalSyncSucceeded("factbook.fao-faostat", summary);

  return NextResponse.json({
    ok: true,
    step: "factbook.fao-faostat.sync",
    started: startedAt,
    finished: summary.finishedAt,
    durationSec: Math.round(summary.durationMs / 1000),
    jurisdictionsInScope: summary.jurisdictionsInScope,
    vintageLabel: summary.vintageLabel,
    archiveBytes: summary.archiveBytes,
    totalWritten: summary.totalWritten,
    perFact: summary.countersByFactKey,
    disputes: summary.disputes,
    errorCount: summary.errors.length,
  });
}

const cronHandler = withCronJob("factbook.fao-faostat", handler);

export { cronHandler as GET, cronHandler as POST };
