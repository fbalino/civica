/**
 * Wikidata officeholder sync — cron handler.
 *
 * Runs monthly via Vercel cron. Authenticated by `CRON_SECRET`
 * (per `requireCronAuth`). Refreshes the head-of-state / head-of-government
 * spine AND the P39 title + P102/colour party enrichment, then stamps
 * `sources.last_sync_at` for `wikidata` (via the shared sync core).
 *
 * The full pass hits Wikidata SPARQL + the entity API and takes roughly
 * 10 minutes at Wikidata's politeness throttle; allow the max cron budget
 * (mirrors `/api/cron/factbook/sync-wikidata`).
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { syncFactbookOfficeholders } from "@/lib/factbook/officeholders-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Full pass: ~200 sovereign states × spine upserts + batched SPARQL
// enrichment at ~800ms throttle ≈ 10 min. Vercel max for cron is 800s on Pro.
export const maxDuration = 800;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    const summary = await syncFactbookOfficeholders({
      db,
      // Drop progress lines in cron mode — too verbose for the log buffer.
      // The summary at the end has counters; warnings (`!`) still surface.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
      dryRun,
    });

    if (summary.totalRowsWritten === 0) {
      return NextResponse.json({ ok: false, step: "factbook.officeholders.sync", dryRun, error: "No officeholder rows produced" }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
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
  } catch (err) {
    console.error("[cron factbook.officeholders.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.officeholders.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
