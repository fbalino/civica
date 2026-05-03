/**
 * Phase F.6 — World Bank WDI sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET`
 * (per `requireCronAuth`). Six WDI indicators × ~265 economies
 * fetched in 6 paginated calls (most indicators fit in 2–3 pages
 * at per_page=1000). Total wall time is dominated by upserts, not
 * fetches; expect ~60–120s on a warm DB.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Implementation plan: F.6.
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncWorldBankWdi } from "@/lib/factbook/reconcile/sync-wdi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncWorldBankWdi(db, {
      // Cron always runs a full pass over all 6 WDI indicators.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });

    return NextResponse.json({
      ok: true,
      step: "factbook.wdi.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsInScope: summary.jurisdictionsInScope,
      totalWritten: summary.totalWritten,
      perFact: summary.countersByFactKey,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.wdi.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.wdi.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
