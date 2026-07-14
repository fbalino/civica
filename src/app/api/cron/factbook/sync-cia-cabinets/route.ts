/**
 * CIA World Leaders cabinet sync — cron handler (day-of-month sharded).
 *
 * Runs DAILY via Vercel cron. Authenticated by `CRON_SECRET`
 * (per the shared cron boundary). Ingests cabinet + central-bank + deputy + other
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
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import {
  buildCiaSlugList,
  syncCiaCabinets,
} from "@/lib/factbook/cia-cabinets-sync";
import { ciaCabinetSyncCronOutcome } from "@/lib/factbook/cron-outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One shard ≈ 9 pages × 10s crawl-delay + DB writes ≈ 3–4 min (measured 227s).
// Worst case every page in a shard hits the fetch retry ladder (~41s each),
// pushing toward ~400s — so budget 600s for safe headroom (Vercel Pro max 800).
export const maxDuration = 600;

// Spread the directory across 28 shards so every calendar month (incl.
// February) fully cycles. Days 29–31 map back onto shards 0–2 (idempotent).
const SHARD_COUNT = 28;

export function resolveCiaCabinetShard(
  request: Request,
  now = new Date(),
): { ok: true; shardIndex: number } | { ok: false; error: string } {
  const url = new URL(request.url);
  const requested = url.searchParams.get("shard");
  const manual = request.headers.has("idempotency-key");
  if (manual && requested === null) {
    return {
      ok: false,
      error: "Manual cabinet deliveries require an explicit shard (0-27)",
    };
  }
  if (
    requested !== null &&
    (!/^\d+$/.test(requested) ||
      Number(requested) < 0 ||
      Number(requested) >= SHARD_COUNT)
  ) {
    return { ok: false, error: "Cabinet shard must be an integer from 0-27" };
  }
  return {
    ok: true,
    shardIndex:
      requested === null
        ? (now.getUTCDate() - 1) % SHARD_COUNT
        : Number(requested),
  };
}

async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    const shard = resolveCiaCabinetShard(request);
    if (!shard.ok) {
      return NextResponse.json(
        { ok: false, step: "factbook.cia-cabinets.sync", error: shard.error },
        { status: 400 },
      );
    }
    // Deterministic, sorted full list → stable per-day shard membership.
    const allSlugs = await buildCiaSlugList(db);
    const shardIndex = shard.shardIndex;
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
      dryRun,
    });
    const { httpStatus, ...outcome } = ciaCabinetSyncCronOutcome(summary);

    if (!outcome.ok) {
      return NextResponse.json(
        {
          ...outcome,
          step: "factbook.cia-cabinets.sync",
          dryRun,
          errors: summary.skipped.length
            ? summary.skipped
            : [{ reason: outcome.reason ?? "Incomplete cabinet sync" }],
        },
        { status: httpStatus },
      );
    }

    return NextResponse.json({
      ...outcome,
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
      dryRun,
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

const cronHandler = withCronJob("factbook.cia-cabinets", handler);

export { cronHandler as GET, cronHandler as POST };
