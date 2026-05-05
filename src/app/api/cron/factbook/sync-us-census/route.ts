/**
 * Phase R.13 — US Census Bureau sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET` (per
 * `requireCronAuth`). 6 indicators × 1 jurisdiction × ~7 fetches in
 * total (urbanization_rate composes 2 datasets). Total wall time is
 * dominated by upserts, not fetches; expect ~5–15s on a warm DB.
 *
 * **United-States-only scope.** Per resolution §2d, US Census writes
 * rows for `iso2='US'` ONLY. For non-US jurisdictions, Civica's
 * resolver continues using IMF/WB/UN/etc. Census Bureau has no
 * methodological claim outside US borders.
 *
 * **Multi-canonical with scope predicate.** Per resolution §2d / §2e
 * (Option C), all R.13 indicators ship with `civicaRole='canonical'`.
 * Existing Tier-1 (`world_bank`, `un_data`, etc.) `'canonical'` tags
 * STAY in place — US Census ADDS as a concurrent canonical publisher
 * bounded by `iso2='US'` scope. The methodology page (R.23) renders
 * multi-canonical attribution with scope predicates. Same architectural
 * pattern as R.7 OECD (member-only) and R.11 Eurostat (EU+EFTA-only),
 * applied at country grain.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.13
 * Resolution:  ~/civica/plan/us-census-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncUsCensus } from "@/lib/factbook/reconcile/sync-us-census";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncUsCensus(db, {
      // Cron always runs a full pass over all US Census indicators in scope.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });

    return NextResponse.json({
      ok: true,
      step: "factbook.us-census.sync",
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
    console.error("[cron factbook.us-census.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.us-census.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
