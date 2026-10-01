/**
 * Phase F.2 — Wikidata sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET`
 * (per the shared cron boundary). The full 197-jurisdiction × 7-fact-key
 * pass uses one batched request per jurisdiction. Upstream acquisition stops
 * at 600s so dispute persistence and terminal bookkeeping retain 200s of the
 * Vercel execution window.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2
 * Implementation plan: F.2.
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { syncFactbookWikidata } from "@/lib/factbook/reconcile/wikidata-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel max for cron is 800s on Pro. The sync's acquisition budget below
// intentionally leaves the final 200s for disputes and job bookkeeping.
export const maxDuration = 800;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  const summary = await syncFactbookWikidata(db, {
    // Cron always does a full pass; no per-fact filters.
    // Logs go to Vercel logs via console.log.
    onProgress: (line) => {
      // Drop progress lines in cron mode — too verbose for the
      // log buffer. The summary at the end has counters.
      if (line.startsWith("!")) console.error(line);
    },
    dryRun,
    acquisitionBudgetMs: 600_000,
    // Every Neon HTTP operation is bounded at 10s. A 730s terminal cutoff
    // leaves at least 70s for the cron wrapper's terminal DB outcome writes.
    terminalBudgetMs: 730_000,
  });

  if (summary.errors.length > 0 || summary.totalAdmitted === 0) {
    return NextResponse.json(
      {
        ok: false,
        outcome: summary.errors.length > 0 ? "partial" : "empty_result",
        step: "factbook.wikidata.sync",
        dryRun,
        errorCount: Math.max(1, summary.errors.length),
        jurisdictionsProcessed: summary.jurisdictionsProcessed,
        totalAdmitted: summary.totalAdmitted,
        phaseTiming: summary.phaseTiming,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    step: "factbook.wikidata.sync",
    started: startedAt,
    finished: summary.finishedAt,
    durationSec: Math.round(summary.durationMs / 1000),
    jurisdictionsProcessed: summary.jurisdictionsProcessed,
    totalAdmitted: summary.totalAdmitted,
    perFact: summary.factCountersByKey,
    phaseTiming: summary.phaseTiming,
    dryRun,
  });
}

const cronHandler = withCronJob("factbook.wikidata", handler);

export { cronHandler as GET, cronHandler as POST };
