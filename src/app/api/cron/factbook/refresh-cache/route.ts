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
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { refreshJurisdictionCache } from "@/lib/factbook/reconcile/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Per-jurisdiction the work is small (1 batch query + 1 update);
// the loop is the only cost. ~270 × ~50ms ≈ 14s. Allow 120s.
export const maxDuration = 120;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    const summary = await refreshJurisdictionCache(db, {
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
      dryRun,
    });

    if (summary.errors.length > 0 || summary.jurisdictionsRefreshed === 0) {
      return NextResponse.json(
        {
          ok: false,
          step: "factbook.refresh-cache",
          dryRun,
          errors: summary.errors.length
            ? summary.errors
            : ["No jurisdictions refreshed"],
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      step: "factbook.refresh-cache",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsRefreshed: summary.jurisdictionsRefreshed,
      fieldsWritten: summary.fieldsWritten,
      errorCount: summary.errors.length,
      dryRun,
    });
  } catch (err) {
    console.error("[cron factbook.refresh-cache] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.refresh-cache",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("factbook.refresh-cache", handler);

export { cronHandler as GET, cronHandler as POST };
