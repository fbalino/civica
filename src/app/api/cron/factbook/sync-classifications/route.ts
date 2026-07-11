/**
 * Phase F.2.1 — Combined classification sync cron handler.
 *
 * Runs all three F.2.1 syncs in sequence:
 *   1. World Bank region + income group
 *   2. V-Dem Regimes of the World (via QoG)
 *   3. monarchy_status + government_form_description (CIA-derived)
 *
 * Annual cadence — fires mid-July, two weeks after WB's typical
 * July 1 classification refresh, to give the upstream time to
 * settle. V-Dem ships ~March; the QoG distribution catches up
 * within a quarter or two.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2
 * Resolution:  ~/Downloads/resolution\ \(2\).md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import {
  syncWorldBankClassifications,
  syncVdemRow,
  syncMonarchyAndGovernmentForm,
} from "@/lib/factbook/reconcile/sync-classifications";
import { assertExternalSyncSucceeded } from "@/lib/data/external-sync-outcome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// WB ~17s + V-Dem QoG fetch ~12s + monarchy ~10s ≈ 40s. Allow 180s.
export const maxDuration = 180;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const wb = await syncWorldBankClassifications(db, { dryRun });
    const vdem = await syncVdemRow(db, { dryRun });
    const monarchy = await syncMonarchyAndGovernmentForm(db, { dryRun });

    assertExternalSyncSucceeded("factbook.classifications.world-bank", {
      totalWritten: wb.regionRowsWritten + wb.incomeRowsWritten,
      errors: wb.errors,
      dryRun,
    });
    assertExternalSyncSucceeded("factbook.classifications.vdem", {
      totalWritten: vdem.rowsWritten,
      errors: vdem.errors,
      dryRun,
    });
    assertExternalSyncSucceeded("factbook.classifications.monarchy", {
      totalWritten: monarchy.monarchyRowsWritten + monarchy.formDescriptionRowsWritten,
      errors: monarchy.errors,
      dryRun,
    });

    const totalErrors = [
      ...wb.errors,
      ...vdem.errors,
      ...monarchy.errors,
    ];

    return NextResponse.json({
      ok: totalErrors.length === 0,
      step: "factbook.sync-classifications",
      started: startedAt,
      finished: new Date().toISOString(),
      worldBank: {
        regionRows: wb.regionRowsWritten,
        incomeRows: wb.incomeRowsWritten,
        durationSec: Math.round(wb.durationMs / 1000),
        errors: wb.errors.length,
      },
      vdem: {
        rows: vdem.rowsWritten,
        durationSec: Math.round(vdem.durationMs / 1000),
        errors: vdem.errors.length,
      },
      monarchy: {
        monarchyRows: monarchy.monarchyRowsWritten,
        formRows: monarchy.formDescriptionRowsWritten,
        buckets: monarchy.monarchyBuckets,
        durationSec: Math.round(monarchy.durationMs / 1000),
        errors: monarchy.errors.length,
      },
      totalErrors: totalErrors.length,
    });
  } catch (err) {
    console.error("[cron factbook.sync-classifications] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.sync-classifications",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
