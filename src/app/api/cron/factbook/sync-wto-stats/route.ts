/**
 * Phase R.12 — WTO Stats sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET` (per
 * `requireCronAuth`). 2 indicators sliced from a single bulk-download
 * pass over the WTO merchandise annual ZIP archive (~2 MB compressed).
 * Total wall time is dominated by upserts (~380 rows) plus the in-
 * memory CSV parse; expect ~30–60s on a warm DB.
 *
 * **Bulk-download architecture.** Per resolution §2a, R.12 fetches
 * the keyless bulk-download ZIP from `stats.wto.org/assets/UserGuide/`
 * rather than calling the REST API at `api.wto.org/timeseries/v1/`
 * (which requires Azure APIM `Ocp-Apim-Subscription-Key` header
 * verified live 2026-05-04 returning HTTP 401 with WWW-Authenticate).
 * Single-request architecture matches Civica's keyless cron
 * preference (mirrors R.8 FAO).
 *
 * **Both indicators canonical.** WTO Stats is the upstream-canonical
 * publisher for merchandise trade per the WTO Statistical Programme's
 * mandate. WB's `NE.EXP.GNFS.CD` ships goods+services (a different
 * BoP-style aggregate) — Civica's two-fact-key split puts WTO and WB
 * at distinct fact-keys (`*_merchandise_usd` vs.
 * `*_goods_services_usd`) so they don't compete on the same fact-key.
 * Per resolution §2d.
 *
 * **Idempotent legacy migration.** The first run also renames legacy
 * trade-aggregate fact-keys (`exports_total_usd`, `imports_total_usd`,
 * `exports_total`, `imports_total`) into the two `*_goods_services_usd`
 * fact-keys + flips WB's `civicaRole` from alternate to canonical +
 * tightens the `sources.license` field for `wto_stats` to `'ODbL-1.0'`.
 * The migration is gated by `WHERE fact_key = '<old>'` filters;
 * subsequent runs no-op the migration step. Per
 * `~/civica/plan/trade-aggregate-fact-keys-v1.md` §2d.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.12
 * Resolution:  ~/civica/plan/wto-stats-resolution-v1.md
 * Resolution:  ~/civica/plan/trade-aggregate-fact-keys-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncWtoStats } from "@/lib/factbook/reconcile/sync-wto-stats";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncWtoStats(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      // Cron always runs a full pass over all WTO indicators.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });
    assertExternalSyncSucceeded("factbook.wto-stats", summary);

    return NextResponse.json({
      ok: true,
      step: "factbook.wto-stats.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsInScope: summary.jurisdictionsInScope,
      vintageLabel: summary.vintageLabel,
      archiveBytes: summary.archiveBytes,
      totalWritten: summary.totalWritten,
      perFact: summary.countersByFactKey,
      legacyMigration: summary.legacyMigration,
      disputes: summary.disputes,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.wto-stats.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.wto-stats.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
