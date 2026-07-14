/**
 * Wikidata officeholder sync — cron handler.
 *
 * Runs monthly via Vercel cron. Authenticated by `CRON_SECRET`
 * (per the shared cron boundary). Refreshes the head-of-state / head-of-government
 * spine AND the P39 title + P102/colour party enrichment, then stamps
 * `sources.last_sync_at` for `wikidata` (via the shared sync core).
 *
 * The full pass hits Wikidata SPARQL + the entity API and takes roughly
 * 10 minutes at Wikidata's politeness throttle; allow the max cron budget
 * (mirrors `/api/cron/factbook/sync-wikidata`).
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { officeholderSyncCronOutcome } from "@/lib/factbook/cron-outcomes";
import { syncFactbookOfficeholders } from "@/lib/factbook/officeholders-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Full pass: ~200 sovereign states × spine upserts + batched SPARQL
// enrichment at ~800ms throttle ≈ 10 min. Vercel max for cron is 800s on Pro.
export const maxDuration = 800;

async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  const summary = await syncFactbookOfficeholders({
    db,
    // Drop progress lines in cron mode — too verbose for the log buffer.
    // The summary at the end has counters; warnings (`!`) still surface.
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
    },
    dryRun,
  });

  const outcome = officeholderSyncCronOutcome(summary);
  if (!outcome.ok) {
    return NextResponse.json(
      {
        ok: false,
        outcome: outcome.outcome,
        healthOk: outcome.healthOk,
        step: "factbook.officeholders.sync",
        dryRun,
        error:
          outcome.reason === "incomplete_stage"
            ? "Officeholder sync completed only part of its stages"
            : "No officeholder rows produced",
        countriesSynced: summary.countriesSynced,
        totalRowsWritten: summary.totalRowsWritten,
        freshnessStamped: summary.freshnessStamped,
      },
      { status: outcome.httpStatus },
    );
  }

  return NextResponse.json({
    ok: true,
    outcome: outcome.outcome,
    healthOk: outcome.healthOk,
    step: "factbook.officeholders.sync",
    started: startedAt,
    finished: summary.finishedAt,
    durationSec: Math.round(summary.durationMs / 1000),
    countriesSynced: summary.countriesSynced,
    countriesSkipped: summary.countriesSkipped,
    qidNamesResolved: summary.qidNamesResolved,
    titlesWritten: summary.titlesWritten,
    partiesWritten: summary.partiesWritten,
    portraitsWritten: summary.portraitsWritten,
    birthdatesWritten: summary.birthdatesWritten,
    personPortraitsWritten: summary.personPortraitsWritten,
    personBirthdatesWritten: summary.personBirthdatesWritten,
    totalRowsWritten: summary.totalRowsWritten,
    freshnessStamped: summary.freshnessStamped,
    dryRun,
  });
}

const cronHandler = withCronJob("factbook.officeholders", handler);

export { cronHandler as GET, cronHandler as POST };
