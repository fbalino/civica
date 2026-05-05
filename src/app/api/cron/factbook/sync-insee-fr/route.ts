/**
 * Phase R.15 — INSEE (France) sync cron handler.
 *
 * **First NSO publisher in v1** (alongside R.13 US Census + R.14
 * ONS-UK). Runs monthly via Vercel cron at 04:00 UTC on the 1st.
 * Authenticated by `CRON_SECRET` (per `requireCronAuth`).
 *
 * 5 indicators × 1 jurisdiction (France) via 5 single-idbank fetches
 * over INSEE's open BDM SDMX endpoint. Each fetch is ~2KB XML;
 * total wall time is dominated by the 5 individual roundtrips
 * (~1s each) plus 5 upserts. Expect <10s on a warm DB.
 *
 * **France-only scope.** R.15 writes for FRA exclusively. INSEE BDM
 * publishes only French national / sub-national data; no
 * cross-country aggregation in scope.
 *
 * **Multi-canonical with scope predicate.** Per resolution §2d, all
 * 5 R.15 indicators ship with `civicaRole='canonical'`. Existing
 * IMF/WB/OECD/Eurostat `canonical` tags for FRA STAY in place —
 * INSEE ADDS as the upstream NSO publisher. The methodology page
 * (R.23) renders multi-canonical attribution per scope. The
 * resolver remains freshness-driven; bit-exact-tied freshness
 * (e.g. INSEE inflation 0.9% 2025 = Eurostat HICP 0.9% 2025) is
 * broken by a separate parallel resolver `sourcePriority` patch
 * keyed on the exact source slug `insee_fr`.
 *
 * **License: Etalab Open Licence v2.0** (commercial-OK with
 * attribution; SPDX `Etalab-2.0`). Per-row references payload
 * carries the license string for R.23 alternates-panel rendering.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.15
 * Resolution:  ~/civica/plan/insee-fr-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncInseeFr } from "@/lib/factbook/reconcile/sync-insee-fr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncInseeFr(db, {
      // Cron always runs a full pass over all INSEE indicators in scope.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });

    return NextResponse.json({
      ok: true,
      step: "factbook.insee-fr.sync",
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
    console.error("[cron factbook.insee-fr.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.insee-fr.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
