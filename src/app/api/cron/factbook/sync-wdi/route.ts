/**
 * Phase F.6 — World Bank WDI sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET`
 * (per the shared cron boundary). Six WDI indicators × ~265 economies
 * fetched in 6 paginated calls (most indicators fit in 2–3 pages
 * at per_page=1000). Total wall time is dominated by upserts, not
 * fetches; expect ~60–120s on a warm DB.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Implementation plan: F.6.
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { syncWorldBankWdi } from "@/lib/factbook/reconcile/sync-wdi";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();

  const summary = await syncWorldBankWdi(db, {
    dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
    // Cron always runs a full pass over all 6 WDI indicators.
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
    },
  });
  assertExternalSyncSucceeded("factbook.wdi", summary);

  return NextResponse.json({
    ok: true,
    step: "factbook.wdi.sync",
    started: startedAt,
    finished: summary.finishedAt,
    durationSec: Math.round(summary.durationMs / 1000),
    jurisdictionsInScope: summary.jurisdictionsInScope,
    totalWritten: summary.totalWritten,
    perFact: summary.countersByFactKey,
    errorCount: summary.errors.length,
  });
}

const cronHandler = withCronJob("factbook.wdi", handler);

export { cronHandler as GET, cronHandler as POST };
