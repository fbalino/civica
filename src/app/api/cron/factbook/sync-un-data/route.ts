/**
 * Phase R.3 — UN Population Division (WPP 2024) sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET`
 * (per the shared cron boundary). 7 indicators × one fetch each = ~7 round
 * trips, each ~80–250 KB ZIP-CSV. Total wall time dominated by
 * upserts: expect ~30–90s on a warm DB.
 *
 * WPP releases biennially (next: 2026 Revision, mid-2026); the
 * quarterly cron re-fetches the same 2024-vintage data 7 times
 * before the next revision. Idempotency makes this cheap. The
 * vintage constant `UN_WPP_VINTAGE` in `sync-un-data.ts` should be
 * bumped when the next revision lands.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.3
 * Resolution:  ~/civica/plan/un-data-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { syncUnData } from "@/lib/factbook/reconcile/sync-un-data";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();

  try {
    const summary = await syncUnData(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      // Cron always runs a full pass over all UN PopDiv indicators.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });
    assertExternalSyncSucceeded("factbook.un-data", summary);

    return NextResponse.json({
      ok: true,
      step: "factbook.un-data.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsInScope: summary.jurisdictionsInScope,
      vintageLabel: summary.vintageLabel,
      totalWritten: summary.totalWritten,
      perFact: summary.countersByFactKey,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.un-data.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.un-data.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("factbook.un-data", handler);

export { cronHandler as GET, cronHandler as POST };
