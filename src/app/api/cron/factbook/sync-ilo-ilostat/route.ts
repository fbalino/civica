/**
 * Phase R.10 — ILO ILOSTAT sync cron handler.
 *
 * Runs annually each November via Vercel cron (matching the ILOEST
 * release cadence — ILO publishes new modelled-estimate vintages once
 * per year, around early November). Authenticated by `CRON_SECRET`
 * (per `requireCronAuth`). 4 ILO indicators × 1 unpaginated fetch
 * each (~150KB each, ~600KB total). Total wall time is dominated by
 * upserts, not fetches; expect ~30–90s on a warm DB.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.10
 * Resolution:  ~/civica/plan/ilo-ilostat-resolution-v1.md
 * Bug 1:       ~/civica/plan/forecast-vs-measurement-v1.md (refined
 *              Q4 — year-based discriminator for ILO modelled
 *              imputation vs. modelled projection)
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncIloIlostat } from "@/lib/factbook/reconcile/sync-ilo-ilostat";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncIloIlostat(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      // Cron always runs a full pass over all 4 ILO indicators.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });
    assertExternalSyncSucceeded("factbook.ilo-ilostat", summary);

    return NextResponse.json({
      ok: true,
      step: "factbook.ilo-ilostat.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsInScope: summary.jurisdictionsInScope,
      vintageLabels: summary.vintageLabels,
      totalWritten: summary.totalWritten,
      perFact: summary.countersByFactKey,
      disputes: summary.disputes,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.ilo-ilostat.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.ilo-ilostat.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
