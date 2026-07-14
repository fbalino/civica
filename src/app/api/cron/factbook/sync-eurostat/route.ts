/**
 * Phase R.11 — Eurostat sync cron handler.
 *
 * Runs quarterly via Vercel cron. Authenticated by `CRON_SECRET` (per
 * the shared cron boundary). 5 indicators × ~30 EU+EFTA-member rows in 5
 * unpaginated JSON-stat fetches (~30KB each, ~150KB total). Total
 * wall time is dominated by upserts, not fetches; expect ~10–30s on a
 * warm DB.
 *
 * **EU+EFTA-only scope.** Per resolution §2c, Eurostat writes rows
 * for the 27 EU member states + 4 EFTA partners (Iceland,
 * Liechtenstein, Norway, Switzerland) ONLY. Non-member observations
 * (UK post-Brexit, US partner, EU candidates, aggregates) are
 * counted (`skipped_non_eu_efta_member`) but not written. Civica's
 * resolver uses IMF/WB/OECD/ILO/etc. for non-EU/EFTA countries —
 * Eurostat has no canonical methodological claim outside its
 * EU + EEA membership.
 *
 * **Multi-canonical with scope predicate.** Per resolution §2d, all
 * 5 R.11 indicators ship with `civicaRole='canonical'`. Existing
 * IMF/WB/OECD/ILO `canonical` tags STAY in place — Eurostat ADDS as
 * a concurrent canonical publisher bounded by EU+EFTA scope. The
 * methodology page (R.23) renders multi-canonical attribution per
 * scope. User's grounding (2026-05-04 sign-off): "for European
 * countries this is mostly publisher transparency rather than
 * independent verification."
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.11
 * Resolution:  ~/civica/plan/eurostat-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { syncEurostat } from "@/lib/factbook/reconcile/sync-eurostat";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();

  try {
    const summary = await syncEurostat(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      // Cron always runs a full pass over all Eurostat indicators in scope.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });
    assertExternalSyncSucceeded("factbook.eurostat", summary);

    return NextResponse.json({
      ok: true,
      step: "factbook.eurostat.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsInScope: summary.jurisdictionsInScope,
      vintageLabel: summary.vintageLabel,
      totalWritten: summary.totalWritten,
      perFact: summary.countersByFactKey,
      disputes: summary.disputes,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.eurostat.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.eurostat.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("factbook.eurostat", handler);

export { cronHandler as GET, cronHandler as POST };
