/**
 * Phase R.4 — WHO Global Health Observatory sync cron handler.
 *
 * Runs quarterly via Vercel cron, scheduled one hour after the WB
 * WDI cron to spread load. Authenticated by `CRON_SECRET` (per
 * the shared cron boundary). Two GHO indicators × ~190 country rows each;
 * total wall time is dominated by upserts, expect ~30–60s on a
 * warm DB.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.4
 * Resolution:  ~/civica/plan/who-gho-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { syncWhoGho } from "@/lib/factbook/reconcile/sync-who-gho";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();

  const summary = await syncWhoGho(db, {
    dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
    // Cron always runs a full pass over all WHO GHO indicators.
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
    },
  });
  assertExternalSyncSucceeded("factbook.who-gho", summary);

  return NextResponse.json({
    ok: true,
    step: "factbook.who-gho.sync",
    started: startedAt,
    finished: summary.finishedAt,
    durationSec: Math.round(summary.durationMs / 1000),
    jurisdictionsInScope: summary.jurisdictionsInScope,
    totalWritten: summary.totalWritten,
    perFact: summary.countersByFactKey,
    disputes: summary.disputes,
    errorCount: summary.errors.length,
  });
}

const cronHandler = withCronJob("factbook.who-gho", handler);

export { cronHandler as GET, cronHandler as POST };
