/**
 * Phase R.22 — quarterly fact-vintage snapshot cron.
 *
 * Runs at 04:00 UTC on Jan 15 / Apr 15 / Jul 15 / Oct 15
 * (T+15 days after each quarter close, per
 * `~/civica/plan/vintage-cadence-resolution-v1.md` § 2c). The
 * 15-day buffer captures upstream cadences that publish 5–10 days
 * after quarter-end (WB WDI, IMF April / October release,
 * Eurostat ESA quarterly) with the smallest reader-visible delay.
 *
 * Authenticated via `requireCronAuth` against `CRON_SECRET`.
 * Idempotent — re-runs of the same vintage label upsert the same
 * rows (the unique index on
 * `(jurisdiction_id, fact_key, vintage_label)` collapses
 * duplicates).
 *
 * The cron's job is to freeze the live resolver's output as a
 * citable artefact. It does NOT re-cut prior vintages, does
 * NOT modify `country_facts`, and does NOT change canonical
 * picks for the live API. It only writes
 * `country_fact_vintages`.
 *
 * Runtime-vs-snapshot split:
 *   - Reader-facing factbook pages and the public API call the
 *     resolver at runtime via `getCanonicalFact()`. New sources
 *     are visible immediately on next page load.
 *   - This snapshot is the *citation handle* surface — a frozen
 *     artefact for academic replication that won't move. Cuts
 *     are quarterly via this cron.
 *
 * Diagnostic overrides:
 *   - `?dryRun=1` — runs the resolver but skips DB writes.
 *   - `?vintageLabel=<custom>` — overrides the auto-derived
 *     label. Useful for backfill cuts (e.g., re-cutting a
 *     historical vintage manually).
 *   - `?jurisdiction=<slug>` — restricts the cut to one
 *     jurisdiction (smoke test).
 *
 * Methodology: ~/civica/plan/vintage-cadence-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { snapshotCurrentVintage } from "@/lib/factbook/reconcile/snapshot-vintage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 17,500-ish (jurisdiction, fact_key) pairs at ~5–10ms/pair through
// the resolver = ~90–180s. 300s headroom matches Vercel Pro tier
// limit and gives buffer for slow pairs / network blips.
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const vintageLabel = url.searchParams.get("vintageLabel") ?? undefined;
  const jurisdictionSlug =
    url.searchParams.get("jurisdiction") ?? undefined;

  try {
    const summary = await snapshotCurrentVintage({
      dryRun,
      vintageLabel,
      jurisdictionSlug,
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
        else console.log(line);
      },
    });

    if (summary.errors.length > 0 || summary.snapshotted === 0) {
      return NextResponse.json({ ok: false, step: "factbook.snapshot-vintage", dryRun, errors: summary.errors.length ? summary.errors : [{ error: "No canonical facts snapshotted" }] }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      step: "factbook.snapshot-vintage",
      started: startedAt,
      finished: new Date().toISOString(),
      dryRun,
      vintageLabel: summary.vintageLabel,
      cutAt: summary.cutAt,
      scanned: summary.scanned,
      snapshotted: summary.snapshotted,
      skippedNoFactKey: summary.skippedNoFactKey,
      skippedNoCanonical: summary.skippedNoCanonical,
      errors: summary.errors,
    });
  } catch (err) {
    console.error("[cron factbook.snapshot-vintage] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.snapshot-vintage",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
