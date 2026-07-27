/**
 * Phase R.21 — auto-resolve stale `material_error` disputes.
 *
 * Runs daily at 02:30 UTC (per `vercel.json`). Authenticated via
 * the shared cron boundary against `CRON_SECRET`. Idempotent: stale disputes
 * are flipped to `resolved_auto_stale` and skipped on next run; live
 * disputes are left untouched.
 *
 * The cron's job is queue hygiene, not methodology. It only closes
 * disputes the resolver itself no longer proposes. Manual review
 * remains the primary path for live disputes.
 *
 * Reversibility: every state change writes a `data_facts_audit_log`
 * row with the pre-update state in `before`. The admin detail page
 * exposes a "Reopen" button that flips the dispute back to `open`.
 *
 * Methodology: ~/civica/plan/disputes-triage-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { autoResolveStaleDisputes } from "@/lib/factbook/reconcile/auto-resolve-disputes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Auto-resolve runs are short — at typical volume (≤200 disputes) they
// finish in under a minute. 120s headroom for periodic backlogs.
export const maxDuration = 120;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam
    ? Math.max(1, parseInt(limitParam, 10) || 0)
    : undefined;

  const summary = await autoResolveStaleDisputes(db, {
    dryRun,
    limit,
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
      else console.log(line);
    },
  });

  if (summary.errors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        outcome: "partial",
        step: "factbook.auto-resolve-disputes",
        dryRun,
        errorCount: summary.errors.length,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    step: "factbook.auto-resolve-disputes",
    started: startedAt,
    finished: new Date().toISOString(),
    dryRun,
    scanned: summary.scanned,
    stillProposed: summary.stillProposed,
    autoResolved: summary.autoResolved,
    skipped: summary.skipped,
    errorCount: summary.errors.length,
    // Per-dispute outcomes are useful for log-only verification at
    // small scale; capped to 200 for response size sanity.
    outcomes: summary.outcomes.slice(0, 200),
  });
}

const cronHandler = withCronJob("factbook.auto-resolve", handler);

export { cronHandler as GET, cronHandler as POST };
