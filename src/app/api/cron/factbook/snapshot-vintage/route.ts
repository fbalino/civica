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
 * Idempotent and resumable — candidates and winners stage under an invisible
 * release record, then one database-verified state transition publishes the
 * complete cut. Same-label drift fails instead of mutating the release.
 *
 * The cron's job is to freeze the live resolver's output as a
 * citable artefact. It does NOT re-cut prior vintages, does
 * NOT modify `country_facts`, and does NOT change canonical
 * picks for the live API. It writes the release manifest, immutable complete
 * candidate set, and winner rows with candidate pointers.
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
 * Partial jurisdiction cuts are forbidden because they cannot constitute a
 * complete reconciliation release.
 *
 * Methodology: ~/civica/plan/vintage-cadence-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { deriveVintageLabel } from "@/lib/factbook/reconcile/snapshot-vintage";
import { snapshotCompleteCandidateRelease } from "@/lib/factbook/reconcile/snapshot-candidate-release";

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
  const cutDate = new Date();
  const vintageLabel = url.searchParams.get("vintageLabel") ?? deriveVintageLabel(cutDate, "v0.3-beta");

  try {
    const summary = await snapshotCompleteCandidateRelease({ dryRun, vintageLabel, cutDate });

    if (summary.winnerCount === 0 || summary.candidateCount === 0) {
      return NextResponse.json({ ok: false, step: "factbook.snapshot-vintage", dryRun, errors: [{ error: "No complete candidate release produced" }] }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      step: "factbook.snapshot-vintage",
      started: startedAt,
      finished: new Date().toISOString(),
      dryRun,
      vintageLabel: summary.vintageLabel,
      cutAt: summary.cutAt,
      candidateCount: summary.candidateCount,
      winnerCount: summary.winnerCount,
      candidateSetChecksum: summary.candidateSetChecksum,
      winnerSetChecksum: summary.winnerSetChecksum,
      unchanged: summary.unchanged,
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
