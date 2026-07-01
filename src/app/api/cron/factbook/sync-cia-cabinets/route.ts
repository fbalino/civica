/**
 * CIA World Leaders cabinet sync — cron handler (day-of-month sharded).
 *
 * Runs DAILY via Vercel cron. Authenticated by `CRON_SECRET`
 * (per `requireCronAuth`). Ingests cabinet + central-bank + deputy + other
 * officials from the CIA "World Leaders" foreign-governments directory
 * (diplomatic dropped per the P4 scope decision) and stamps
 * `sources.last_sync_at` for `cia_world_leaders` (via the shared sync core).
 *
 * WHY SHARDED (and not a single monthly run like the Wikidata syncs): the CIA
 * directory has no bulk/SPARQL endpoint, so this is a page-by-page HTML crawl
 * bound by cia.gov's 10s robots.txt crawl-delay. A full ~194-page pass takes
 * 35–45 min — far past any Vercel function budget. So each daily run refreshes
 * only its shard (~7 countries, well under the crawl-delay budget), and the
 * full directory cycles through once per month. Shard membership is stable
 * (the slug list is sorted + deterministic), so each country refreshes on a
 * fixed day-of-month. Writes are idempotent, so days 29–31 harmlessly re-crawl
 * shards 0–2. Freshness re-stamps on any day a shard writes rows.
 */
import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import {
  buildCiaSlugList,
  syncCiaCabinets,
} from "@/lib/factbook/cia-cabinets-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One shard ≈ 9 pages × 10s crawl-delay + DB writes ≈ 3–4 min (measured 227s).
// Worst case every page in a shard hits the fetch retry ladder (~41s each),
// pushing toward ~400s — so budget 600s for safe headroom (Vercel Pro max 800).
export const maxDuration = 600;

// Spread the directory across 28 shards so every calendar month (incl.
// February) fully cycles. Days 29–31 map back onto shards 0–2 (idempotent).
const SHARD_COUNT = 28;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = new Date().toISOString();

  try {
    // Deterministic, sorted full list → stable per-day shard membership.
    const allSlugs = await buildCiaSlugList(db);
    const shardIndex = (new Date().getUTCDate() - 1) % SHARD_COUNT;
    const perShard = Math.ceil(allSlugs.length / SHARD_COUNT);
    const slugs = allSlugs.slice(
      shardIndex * perShard,
      shardIndex * perShard + perShard,
    );

    if (slugs.length === 0) {
      return NextResponse.json({
        ok: true,
        step: "factbook.cia-cabinets.sync",
        started: startedAt,
        shardIndex,
        shardCount: SHARD_COUNT,
        countriesInShard: 0,
        note: "Empty shard for this day-of-month — nothing to crawl.",
      });
    }

    const summary = await syncCiaCabinets({
      db,
      slugs,
      // Drop progress lines in cron mode — too verbose for the log buffer.
      // Warnings (`!`) still surface.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
    });

    return NextResponse.json({
      ok: true,
      step: "factbook.cia-cabinets.sync",
      started: startedAt,
      finished: summary.finishedAt,
      durationSec: Math.round(summary.durationMs / 1000),
      shardIndex,
      shardCount: SHARD_COUNT,
      countriesInShard: slugs.length,
      countriesCrawled: summary.countriesCrawled,
      countriesApplied: summary.countriesApplied,
      countriesFetchFailed: summary.countriesFetchFailed,
      countriesUnmatched: summary.countriesUnmatched,
      officesWritten: summary.officesWritten,
      termsWritten: summary.termsWritten,
      personsExisting: summary.personsExisting,
      personsQidCreated: summary.personsQidCreated,
      personsIdlessCreated: summary.personsIdlessCreated,
      vacantOffices: summary.vacantOffices,
      diplomaticSkipped: summary.diplomaticSkipped,
      statementsWritten: summary.statementsWritten,
      totalRowsWritten: summary.totalRowsWritten,
      freshnessStamped: summary.freshnessStamped,
    });
  } catch (err) {
    console.error("[cron factbook.cia-cabinets.sync] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.cia-cabinets.sync",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
