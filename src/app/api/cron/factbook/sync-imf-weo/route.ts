/**
 * Phase R.2 — IMF World Economic Outlook sync cron handler.
 *
 * Runs semi-annually via Vercel cron (April + October — matching IMF
 * WEO release cadence). Authenticated by `CRON_SECRET` (per
 * `requireCronAuth`). 11 WEO indicators × ~189 sovereign-state ISO3
 * codes fetched in 11 unpaginated calls (~150KB each, ~1.5MB total).
 * Total wall time is dominated by upserts, not fetches; expect
 * ~60–180s on a warm DB.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.2
 * Resolution:  ~/civica/plan/imf-weo-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncImfWeo } from "@/lib/factbook/reconcile/sync-imf-weo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncImfWeo(db, {
      // Cron always runs a full pass over all 11 WEO indicators.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });

    return NextResponse.json({
      ok: true,
      step: "factbook.imf-weo.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsInScope: summary.jurisdictionsInScope,
      vintageLabel: summary.vintageLabel,
      totalWritten: summary.totalWritten,
      perFact: summary.countersByFactKey,
      disputes: summary.disputes,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.imf-weo.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.imf-weo.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
