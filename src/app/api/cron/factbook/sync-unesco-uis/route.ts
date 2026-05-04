/**
 * Phase R.5 — UNESCO Institute for Statistics (UIS) sync cron handler.
 *
 * Runs quarterly via Vercel cron, scheduled one hour after the WHO
 * GHO cron to spread load. Authenticated by `CRON_SECRET` (per
 * `requireCronAuth`). One UIS indicator (LR.AG15T99 → literacy_rate)
 * × ~166 country rows; total wall time is dominated by the JSON
 * fetch + a small batch of upserts. Expect ~10–30s on a warm DB.
 *
 * UIS releases EDUCATION theme data 1–2 times per year (currently
 * "February 2026 Data Release"); the quarterly cron re-fetches the
 * same data 2–4 times before the next theme refresh. Idempotency
 * makes this cheap. The vintage label is resolved live from
 * `/api/public/versions/default` at sync startup, so a new theme
 * release will be picked up automatically without code changes.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.5
 * Resolution:  ~/civica/plan/unesco-uis-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncUnescoUis } from "@/lib/factbook/reconcile/sync-unesco-uis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncUnescoUis(db, {
      // Cron always runs a full pass over all UIS indicators.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });

    return NextResponse.json({
      ok: true,
      step: "factbook.unesco-uis.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsInScope: summary.jurisdictionsInScope,
      vintageLabel: summary.vintageLabel,
      versionHandle: summary.versionHandle,
      totalWritten: summary.totalWritten,
      perFact: summary.countersByFactKey,
      disputes: summary.disputes,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.unesco-uis.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.unesco-uis.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
