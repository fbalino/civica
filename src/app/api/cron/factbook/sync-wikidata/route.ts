/**
 * Phase F.2 — Wikidata sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET`
 * (per `requireCronAuth`). The full 270-jurisdiction × 8-fact-key
 * pass takes roughly 10 minutes at Wikidata's 4 req/s politeness
 * floor; allow 540s.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2
 * Implementation plan: F.2.
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncFactbookWikidata } from "@/lib/factbook/reconcile/wikidata-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Quarterly full pass: ~270 jurisdictions × 8 fact-keys × ~250ms
// throttle ~= 540s. Vercel max for cron is 800s on Pro.
export const maxDuration = 800;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncFactbookWikidata(db, {
      // Cron always does a full pass; no per-fact filters.
      // Logs go to Vercel logs via console.log.
      onProgress: (line) => {
        // Drop progress lines in cron mode — too verbose for the
        // log buffer. The summary at the end has counters.
        if (line.startsWith("!")) console.error(line);
      },
    });

    return NextResponse.json({
      ok: true,
      step: "factbook.wikidata.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsProcessed: summary.jurisdictionsProcessed,
      totalAdmitted: summary.totalAdmitted,
      perFact: summary.factCountersByKey,
    });
  } catch (err) {
    console.error("[cron factbook.wikidata.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.wikidata.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
