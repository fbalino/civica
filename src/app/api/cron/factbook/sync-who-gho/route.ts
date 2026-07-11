/**
 * Phase R.4 — WHO Global Health Observatory sync cron handler.
 *
 * Runs quarterly via Vercel cron, scheduled one hour after the WB
 * WDI cron to spread load. Authenticated by `CRON_SECRET` (per
 * `requireCronAuth`). Two GHO indicators × ~190 country rows each;
 * total wall time is dominated by upserts, expect ~30–60s on a
 * warm DB.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.4
 * Resolution:  ~/civica/plan/who-gho-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncWhoGho } from "@/lib/factbook/reconcile/sync-who-gho";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
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
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.who-gho.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.who-gho.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
