/**
 * Phase R.19 — Stats SA (South Africa) sync cron handler.
 *
 * **NSO Wave 3 publisher** — first NSO in v1 with no programmatic
 * API. PDF-based ingest from `/publications/<P-CODE>/` URLs at
 * statssa.gov.za, extracted via Anthropic SDK native PDF support
 * (Claude Haiku 4.5, tool-use mode, temperature 0).
 *
 * **Cron cadence: quarterly** at 23:00 UTC on the 11th of
 * January, April, July, October (per resolution §2g + Q4 user
 * override 2026-05-05). Hour 23 sits after R.18 IBGE at 22:00
 * UTC. Authenticated by `CRON_SECRET` (per `requireCronAuth`).
 *
 * 4 indicators × 1 jurisdiction (South Africa). Each indicator
 * fetches a PDF (~500KB-5MB) and runs one Anthropic SDK call.
 * Wall time dominated by 4 Anthropic round-trips (~10-30s each
 * for Haiku on a small-PDF input). Expect ~60-120s on a warm DB.
 *
 * **South Africa-only scope.** R.19 writes for ZAF exclusively.
 * Stats SA publishes only South African national data.
 *
 * **Multi-canonical with scope predicate.** Per resolution §2d,
 * all 4 R.19 indicators ship with `civicaRole='canonical'`.
 * Existing IMF/WB/UN/CIA/ILO `canonical` tags for ZAF STAY in
 * place — Stats SA ADDS as the upstream NSO publisher. The
 * methodology page (R.23) renders multi-canonical attribution per
 * scope. The resolver remains freshness-driven; bit-exact-tied
 * freshness ties are broken deterministically by the
 * NSO-priority-tier patch in `nso-overrides.ts` (already shipped
 * with `ZAF: "stats_sa"` in the map).
 *
 * **License:** Stats SA Copyright (CC-BY-4.0 equivalent). Per
 * `~/civica/plan/stats-sa-resolution-v1.md` §2e + Q6 sign-off.
 *
 * **Failure-mode behavior (Q5 user override):** ANY extraction
 * failure → graceful no-op, NEVER a hallucinated row. Skipped
 * indicators surface in `summary.errors[]`; the cron returns 200
 * OK with the partial summary so Vercel doesn't classify the run
 * as failed (operator inspects the response body). Catastrophic
 * failure (e.g. ANTHROPIC_API_KEY_RECONCILIATION unset) returns 500.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 / §3.3
 * Plan:        ~/civica/plan/reconciliation-v1-master-plan.md § R.19
 * Resolution:  ~/civica/plan/stats-sa-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncStatsSa } from "@/lib/factbook/reconcile/sync-stats-sa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const summary = await syncStatsSa(db, {
      // Cron always runs a full pass over all Stats SA indicators
      // in scope.
      onProgress: (line) => {
        if (line.startsWith("!") || line.includes("EXTRACTION FAILURE")) {
          console.error(line);
        }
      },
    });

    return NextResponse.json({
      ok: true,
      step: "factbook.stats-sa.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      jurisdictionsInScope: summary.jurisdictionsInScope,
      vintageLabel: summary.vintageLabel,
      sourceRowInserted: summary.sourceRowInserted,
      totalWritten: summary.totalWritten,
      perFact: summary.countersByFactKey,
      disputes: summary.disputes,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.stats-sa.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.stats-sa.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
