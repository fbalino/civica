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
import {
  cronScheduleSlotFromRequest,
  withCronJob,
} from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import {
  buildCiaSlugList,
  syncCiaCabinets,
  type CabinetFailureCode,
  type CabinetSyncDb,
  type CabinetSyncOptions,
  type CiaCabinetSyncSummary,
} from "@/lib/factbook/cia-cabinets-sync";
import { ciaCabinetSyncCronOutcome } from "@/lib/factbook/cron-outcomes";
import { resolveAtlasReleaseId } from "@/lib/factbook/country-fact-history-writer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One shard ≈ 9 pages × 10s crawl-delay + DB writes ≈ 3–4 min (measured 227s).
// Worst case every page in a shard hits the fetch retry ladder (~41s each),
// pushing toward ~400s — so budget 600s for safe headroom (Vercel Pro max 800).
export const maxDuration = 600;

// Spread the directory across 28 shards so every calendar month (incl.
// February) fully cycles. Days 29–31 map back onto shards 0–2 (idempotent).
const SHARD_COUNT = 28;

type CiaCabinetFailureOutcome =
  | "cabinet_office_identity_conflict"
  | "cabinet_read_failure"
  | "cabinet_schema_failure"
  | "cabinet_persistence_failure"
  | "cabinet_mixed_failure"
  | "cabinet_no_rows"
  | "cabinet_source_freshness_not_stamped";

function retainedCabinetFailureOutcome(
  summary: CiaCabinetSyncSummary,
  reason: string,
): CiaCabinetFailureOutcome {
  if (reason === "no_rows") return "cabinet_no_rows";
  if (reason === "source_freshness_not_stamped") {
    return "cabinet_source_freshness_not_stamped";
  }
  const category = (code: CabinetFailureCode) => {
    switch (code) {
      case "office_identity_conflict":
        return "cabinet_office_identity_conflict" as const;
      case "upstream_http_error":
      case "country_read_error":
        return "cabinet_read_failure" as const;
      case "upstream_schema_error":
        return "cabinet_schema_failure" as const;
      case "persistence_error":
        return "cabinet_persistence_failure" as const;
    }
  };
  const categories = new Set(summary.skipped.map(({ code }) => category(code)));
  return categories.size === 1
    ? ([...categories][0] ?? "cabinet_mixed_failure")
    : "cabinet_mixed_failure";
}

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

interface CiaCabinetHandlerDependencies {
  database?: CabinetSyncDb;
  environment?: Record<string, string | undefined>;
  buildSlugList?: (database: CabinetSyncDb) => Promise<string[]>;
  sync?: (options: CabinetSyncOptions) => Promise<CiaCabinetSyncSummary>;
}

/**
 * Route-level fixture seam. Configuration is resolved before any domain
 * database read or CIA request, while the shared cron boundary continues to
 * own authentication, delivery history, and retry fencing.
 */
export function createCiaCabinetHandler(
  dependencies: CiaCabinetHandlerDependencies = {},
) {
  const database = dependencies.database ?? db;
  const environment = dependencies.environment ?? process.env;
  const buildSlugList = dependencies.buildSlugList ?? buildCiaSlugList;
  const sync = dependencies.sync ?? syncCiaCabinets;

  return async function handler(request: Request) {
    const startedAt = new Date().toISOString();
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

    // This is intentionally route-scoped rather than a global cron startup
    // requirement: unrelated scheduled jobs remain available if this writer's
    // history identity is missing or malformed.
    const atlasReleaseId = resolveAtlasReleaseId(undefined, environment);

    const hasExplicitShard = new URL(request.url).searchParams.has("shard");
    const manual = request.headers.has("idempotency-key");
    const shard = resolveCiaCabinetShard(
      request,
      hasExplicitShard || manual
        ? undefined
        : cronScheduleSlotFromRequest(request),
    );
    if (!shard.ok) {
      return NextResponse.json(
        { ok: false, step: "factbook.cia-cabinets.sync", error: shard.error },
        { status: 400 },
      );
    }
    // Deterministic, sorted full list → stable per-day shard membership.
    const allSlugs = await buildSlugList(database);
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

    const summary = await sync({
      db: database,
      slugs,
      atlasReleaseId,
      // Drop progress lines in cron mode — too verbose for the log buffer.
      // Warnings (`!`) still surface.
      onProgress: (line) => {
        if (line.startsWith("!")) console.error(line);
      },
      dryRun,
    });
    const outcome = ciaCabinetSyncCronOutcome(summary);

    if (!outcome.ok) {
      const retainedOutcome = retainedCabinetFailureOutcome(
        summary,
        outcome.reason ?? "incomplete_stage",
      );
      return NextResponse.json(
        {
          ok: outcome.ok,
          outcome: retainedOutcome,
          healthOk: outcome.healthOk,
          reason: outcome.reason,
          step: "factbook.cia-cabinets.sync",
          dryRun,
          errorCount: Math.max(1, summary.skipped.length),
          shardIndex,
          shardCount: SHARD_COUNT,
          countriesInShard: slugs.length,
          countriesCrawled: summary.countriesCrawled,
          countriesApplied: summary.countriesApplied,
          countriesFetchFailed: summary.countriesFetchFailed,
          countriesSkipped: summary.countriesSkipped,
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
          failures: summary.skipped.map(({ slug, code }) => ({ slug, code })),
        },
        { status: outcome.httpStatus },
      );
    }

    return NextResponse.json({
      ok: outcome.ok,
      outcome: outcome.outcome,
      healthOk: outcome.healthOk,
      reason: outcome.reason,
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
  };
}

const handler = createCiaCabinetHandler();
const cronHandler = withCronJob("factbook.cia-cabinets", handler);

export { cronHandler as GET, cronHandler as POST };
