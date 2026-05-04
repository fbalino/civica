/**
 * Phase R.7 — OECD.Stat sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET` (per
 * `requireCronAuth`). 2 indicators × ~37 OECD-member rows in 2
 * unpaginated SDMX-JSON calls (~50–100KB each, ~150KB total). Total
 * wall time is dominated by upserts, not fetches; expect ~10–30s on a
 * warm DB.
 *
 * **Member-only scope.** Per the resolution §2c, OECD writes rows
 * for the 38 OECD member states ONLY. Non-member observations are
 * counted (`skipped_non_oecd_member`) but not written. Civica's
 * resolver uses WB/IMF/etc. for non-member countries — OECD has no
 * canonical methodological claim outside its membership.
 *
 * **Israel onboarding.** R.7 ships with 37/38 OECD members because
 * Civica's jurisdictions table is missing Israel (`ISR`). The
 * separate R.7.0 jurisdictions backfill phase ships in parallel and
 * adds Israel + UAE; on the next cron after R.7.0 lands, Israel
 * lands cleanly without a code change in this route or in the
 * sync library.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.7
 * Resolution:  ~/civica/plan/oecd-stat-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncOecdStat } from "@/lib/factbook/reconcile/sync-oecd-stat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncOecdStat(db, {
      // Cron always runs a full pass over all OECD indicators in scope.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });

    return NextResponse.json({
      ok: true,
      step: "factbook.oecd-stat.sync",
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
    console.error("[cron factbook.oecd-stat.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.oecd-stat.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
