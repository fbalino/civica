/**
 * Phase R.18 — IBGE (Brazil) sync cron handler.
 *
 * **NSO Wave 2 publisher** (alongside R.17 Statistics Canada in
 * parallel; R.16 Destatis-DE deferred to v1.1). Runs quarterly via
 * Vercel cron at 22:00 UTC on the 11th of Jan/Apr/Jul/Oct.
 * Authenticated by `CRON_SECRET` (per the shared cron boundary).
 *
 * 4 indicators × 1 jurisdiction (Brazil) via 4 single-row fetches
 * over IBGE's open SIDRA REST endpoint. Each fetch is ~700 bytes
 * JSON; total wall time is dominated by the 4 individual roundtrips
 * (~1s each) plus 4 upserts. Expect <10s on a warm DB.
 *
 * **Brazil-only scope.** R.18 writes for BRA exclusively. IBGE
 * SIDRA publishes only Brazilian national / sub-national data; no
 * cross-country aggregation in scope. R.18 fetches `n1` (national
 * territorial level) only.
 *
 * **Multi-canonical with scope predicate.** Per resolution §2d, all
 * 4 R.18 indicators ship with `civicaRole='canonical'`. Existing
 * IMF/WB/UN/Wikidata/CIA `canonical` tags for BRA STAY in place —
 * IBGE ADDS as the upstream NSO publisher. The methodology page
 * (R.23) renders multi-canonical attribution per scope. The
 * resolver remains freshness-driven; bit-exact-tied freshness ties
 * are broken deterministically by the NSO-priority-tier patch in
 * `nso-overrides.ts` (already shipped with `BRA: "ibge_br"` in the
 * map).
 *
 * **License:** Brazilian Federal Open Data Policy via Decreto
 * 8.777/2016 + Lei 12.527/2011 (LAI) + Art. 8 Lei 9.610/1998.
 * SPDX-equivalent slug `public_domain` (matches R.13 US Census
 * convention). Per-row references payload carries the explicit
 * Brazilian-framework descriptor.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.18
 * Resolution:  ~/civica/plan/ibge-br-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { syncIbgeBr } from "@/lib/factbook/reconcile/sync-ibge-br";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();

  try {
    const summary = await syncIbgeBr(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      // Cron always runs a full pass over all IBGE indicators in scope.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });
    assertExternalSyncSucceeded("factbook.ibge-br", summary);

    return NextResponse.json({
      ok: true,
      step: "factbook.ibge-br.sync",
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
    console.error("[cron factbook.ibge-br.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.ibge-br.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("factbook.ibge-br", handler);

export { cronHandler as GET, cronHandler as POST };
