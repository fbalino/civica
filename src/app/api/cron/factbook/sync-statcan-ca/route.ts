/**
 * Phase R.17 — Statistics Canada (StatCan) sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET` (per
 * the shared cron boundary). 3 indicators × 1 jurisdiction × 3 fetches in
 * total (the inflation indicator pulls 13 monthly observations in a
 * single fetch, then composes YoY in-process). Total wall time is
 * dominated by upserts, not fetches; expect ~5-10s on a warm DB.
 *
 * **Canada-only scope.** Per resolution §2d, StatCan writes rows for
 * `iso2='CA'` ONLY. For non-Canada jurisdictions, Civica's resolver
 * continues using IMF/WB/UN/etc. Statistics Canada has no
 * methodological claim outside Canadian borders.
 *
 * **Multi-canonical with scope predicate.** Per resolution §2d / §2e
 * (Option C, inherited from R.13), all R.17 indicators ship with
 * `civicaRole='canonical'`. Existing Tier-1 (`world_bank`, `un_data`,
 * etc.) `'canonical'` tags STAY in place — StatCan ADDS as a
 * concurrent canonical publisher bounded by `iso2='CA'` scope. The
 * methodology page (R.23) renders multi-canonical attribution with
 * scope predicates. Same architectural pattern as R.13 / R.14 / R.15.
 *
 * **NSO-priority-tier patch coordination.** The NSO-priority-tier
 * resolver patch (R.13/R.14/R.15) deterministically picks
 * `statcan_ca` over Tier-1 publishers for the Canada jurisdiction on
 * tied-date races. The map at
 * `src/lib/factbook/reconcile/nso-overrides.ts:42` already covers
 * `CAN: "statcan_ca"`.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.17
 * Resolution:  ~/civica/plan/statcan-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { syncStatCanCa } from "@/lib/factbook/reconcile/sync-statcan-ca";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();

  try {
    const summary = await syncStatCanCa(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      // Cron always runs a full pass over all StatCan indicators in scope.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });
    assertExternalSyncSucceeded("factbook.statcan-ca", summary);

    return NextResponse.json({
      ok: true,
      step: "factbook.statcan-ca.sync",
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
    console.error("[cron factbook.statcan-ca.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.statcan-ca.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("factbook.statcan-ca", handler);

export { cronHandler as GET, cronHandler as POST };
