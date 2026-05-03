/**
 * Phase F.3.5 — Nightly jurisdictions-cache refresh cron handler.
 *
 * Per F.3.5 plan: runs daily at 06:30 UTC, after all sync jobs
 * complete. Updates the denormalised `jurisdictions` columns
 * (population, gdpBillions, areaSqKm, capital, languages,
 * currency, democracyIndex) from the resolver's canonical output,
 * stamps `fact_cache_refreshed_at`.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §1.0
 * Schema doc:  ~/civica/plan/phase-f-schema-v0.1.md §11
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { refreshJurisdictionCache } from "@/lib/factbook/reconcile/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Per-jurisdiction the work is small (1 batch query + 1 update);
// the loop is the only cost. ~270 × ~50ms ≈ 14s. Allow 120s.
export const maxDuration = 120;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await refreshJurisdictionCache(db, {
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });

    return NextResponse.json({
      ok: true,
      step: "factbook.refresh-cache",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsRefreshed: summary.jurisdictionsRefreshed,
      fieldsWritten: summary.fieldsWritten,
      errorCount: summary.errors.length,
    });
  } catch (err) {
    console.error("[cron factbook.refresh-cache] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.refresh-cache",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
