/**
 * Phase R.6 — UNDP Human Development Report (HDR) sync cron handler.
 *
 * Runs quarterly via Vercel cron, scheduled offset from the other
 * Tier-1 syncs to spread load. Authenticated by `CRON_SECRET` (per
 * the shared cron boundary). Six UNDP indicators × ~190 country rows each;
 * the sync downloads a single 1.9 MB CSV once and iterates indicators
 * against the in-memory parse, so total wall time is dominated by
 * upserts. Expect ~60–90s on a warm DB.
 *
 * UNDP HDR ships ~annually in spring. The quarterly cron will be
 * idempotent in non-release quarters (existing rows hit the
 * snapshot dedup); when HDR 2026 ships (expected mid-2026), the
 * URL constant in `sync-undp-hdi.ts` and the `UNDP_HDR_VINTAGE`
 * label both bump in lockstep via a methodology v1.1 update. The
 * methodology resolution (`~/civica/plan/undp-hdi-resolution-v1.md`)
 * §2j + §6 Q5 documents the rotation mechanic.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.6
 * Resolution:  ~/civica/plan/undp-hdi-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { syncUndpHdi } from "@/lib/factbook/reconcile/sync-undp-hdi";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();

  const summary = await syncUndpHdi(db, {
    dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
    // Cron always runs a full pass over all UNDP HDI indicators.
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
    },
  });
  assertExternalSyncSucceeded("factbook.undp-hdi", summary);

  return NextResponse.json({
    ok: true,
    step: "factbook.undp-hdi.sync",
    started: startedAt,
    finished: summary.finishedAt,
    durationSec: Math.round(summary.durationMs / 1000),
    jurisdictionsInScope: summary.jurisdictionsInScope,
    csvCountryRows: summary.csvCountryRows,
    vintageLabel: summary.vintageLabel,
    totalWritten: summary.totalWritten,
    perFact: summary.countersByFactKey,
    disputes: summary.disputes,
    errorCount: summary.errors.length,
  });
}

const cronHandler = withCronJob("factbook.undp-hdi", handler);

export { cronHandler as GET, cronHandler as POST };
