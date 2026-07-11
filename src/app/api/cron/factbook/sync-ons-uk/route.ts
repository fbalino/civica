/**
 * Phase R.14 — ONS-UK sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET` (per
 * `requireCronAuth`). 5 indicators × 1 jurisdiction (UK) in 5
 * unpaginated time-series fetches (~30–80KB each, ~250KB total).
 * Total wall time is dominated by upserts, not fetches; expect
 * ~5–10s on a warm DB.
 *
 * **UK-only scope.** Per resolution §2c, ONS writes rows for ISO3='GBR'
 * ONLY. The 5 ONS series via the public time-series API serve UK total
 * data (no client-side jurisdiction filter beyond the single-
 * jurisdiction resolve). Civica's resolver continues using IMF/WB/UN/
 * ILO/etc. for non-UK countries — ONS has no canonical methodological
 * claim outside its own country.
 *
 * **Multi-canonical with scope predicate (NSO scope = single country).**
 * Per resolution §2d, all 5 R.14 indicators ship with
 * `civicaRole='canonical'` for UK rows. Existing IMF/WB/UN/ILO
 * `canonical` tags STAY in place — ONS ADDS as a concurrent canonical
 * publisher bounded by UK scope. The methodology page (R.23) renders
 * multi-canonical attribution per scope.
 *
 * **NSO-priority-tier patch is the deterministic-tiebreak contract.**
 * `ons_uk` is pre-registered in `nso-overrides.ts` `NSO_SOURCE_BY_ISO3`
 * for `GBR`. The resolver gives ONS priority=0 and other Tier-1
 * publishers priority=1 for UK rows ONLY. Tied-date races resolve
 * deterministically to ONS.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.14
 * Resolution:  ~/civica/plan/ons-uk-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncOnsUk } from "@/lib/factbook/reconcile/sync-ons-uk";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncOnsUk(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      // Cron always runs a full pass over all ONS indicators in scope.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });
    assertExternalSyncSucceeded("factbook.ons-uk", summary);

    return NextResponse.json({
      ok: true,
      step: "factbook.ons-uk.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsInScope: summary.jurisdictionsInScope,
      vintageLabel: summary.vintageLabel,
      totalWritten: summary.totalWritten,
      sourceRowInserted: summary.sourceRowInserted,
      perFact: summary.countersByFactKey,
      disputes: summary.disputes,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.ons-uk.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.ons-uk.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
