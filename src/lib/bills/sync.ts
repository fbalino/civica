/**
 * Shared per-source sync runner. The pattern:
 *   1. Look up the jurisdiction's UUID by slug.
 *   2. Call the source adapter for `BillIngestDraft[]`.
 *   3. Batch-summarise via Claude Haiku (cached).
 *   4. Upsert into `bills` and stamp `sources.last_sync_at`.
 *
 * Each per-country sync script is just a thin caller of `runBillsSync`
 * with the source adapter + jurisdiction slug + iso2 (for cache keys).
 */

import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { jurisdictions } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import {
  makeCacheKey,
  readCachedSummaries,
  generateSummariesBatch,
  writeCachedSummary,
} from "./summarize";
import { upsertBills } from "./upsert";
import type {
  BillFetchResult,
  BillIngest,
  BillSourceFetchOutcome,
} from "./types";

type Db = NeonHttpDatabase<typeof schema>;

export interface RunBillsSyncOptions {
  /** Country slug, e.g. "united-states". */
  jurisdictionSlug: string;
  /** ISO2 code, e.g. "US" — used as the cache-key prefix. */
  iso2: string;
  /** Source adapter call — receives the resolved jurisdictionId. */
  fetchDrafts: (opts: {
    jurisdictionId: string;
  }) => Promise<BillFetchResult>;
  dryRun?: boolean;
  /** Deterministic fixture seams; production callers omit these. */
  jurisdictionId?: string;
  readSummaries?: typeof readCachedSummaries;
  generateSummaries?: typeof generateSummariesBatch;
  cacheSummary?: typeof writeCachedSummary;
  writeRows?: typeof upsertBills;
  /** Reserved for controlled maintenance fixtures. Live external syncs fail closed on emptiness. */
  allowEmpty?: boolean;
}

export interface RunBillsSyncSummary {
  jurisdictionId: string;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  wouldWrite: number;
  summarised: number;
  sourceOutcomes: BillSourceFetchOutcome[];
  sourcesStamped: string[];
  dryRun: boolean;
}

export class BillSourceAggregateError extends Error {
  readonly outcomes: BillSourceFetchOutcome[];

  constructor(jurisdictionSlug: string, outcomes: BillSourceFetchOutcome[]) {
    const failures = outcomes.filter(
      (outcome): outcome is Extract<
        BillSourceFetchOutcome,
        { status: "failed" }
      > => outcome.status === "failed",
    );
    super(
      `Bills upstream failed for ${jurisdictionSlug}: ${failures
        .map((failure) => `${failure.sourceId} (${failure.error})`)
        .join(", ")}`,
    );
    this.name = "BillSourceAggregateError";
    this.outcomes = outcomes;
  }
}

export async function runBillsSync(
  db: Db,
  opts: RunBillsSyncOptions,
): Promise<RunBillsSyncSummary> {
  // Resolve jurisdiction UUID by slug.
  const j = opts.jurisdictionId ? [{ id: opts.jurisdictionId }] : await db
    .select({ id: jurisdictions.id })
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, opts.jurisdictionSlug))
    .limit(1);
  const jurisdictionId = j[0]?.id;
  if (!jurisdictionId) {
    throw new Error(
      `Jurisdiction not found for slug: ${opts.jurisdictionSlug}`,
    );
  }

  // Fetch and stage drafts.
  const fetched = await opts.fetchDrafts({ jurisdictionId });
  const drafts = Array.isArray(fetched) ? fetched : fetched.drafts;
  const sourceOutcomes = Array.isArray(fetched)
    ? Array.from(new Set(fetched.map((draft) => draft.sourceId))).map(
        (sourceId): BillSourceFetchOutcome => ({
          sourceId,
          status: "success",
          fetched: fetched.filter((draft) => draft.sourceId === sourceId)
            .length,
          mapped: fetched.filter((draft) => draft.sourceId === sourceId).length,
        }),
      )
    : fetched.sourceOutcomes;
  if (sourceOutcomes.some((outcome) => outcome.status === "failed")) {
    throw new BillSourceAggregateError(opts.jurisdictionSlug, sourceOutcomes);
  }
  const mappedReported = sourceOutcomes.reduce(
    (sum, outcome) => sum + outcome.mapped,
    0,
  );
  if (mappedReported !== drafts.length) {
    throw new Error(
      `Bills upstream mapping contract drifted for ${opts.jurisdictionSlug}: ` +
        `${mappedReported} mapped row(s) reported for ${drafts.length} draft(s)`,
    );
  }
  const explicitlyBenignEmpty =
    !Array.isArray(fetched) &&
    sourceOutcomes.length > 0 &&
    sourceOutcomes.every(
      (outcome) =>
        outcome.status === "success" &&
        outcome.mapped === 0 &&
        outcome.emptyReason !== undefined,
    );
  if (drafts.length === 0 && !opts.allowEmpty && !explicitlyBenignEmpty) {
    throw new Error(
      `Bills upstream returned no rows for ${opts.jurisdictionSlug}`,
    );
  }


  // Batch-summarise. Cache key uses iso2 + (longTitle || title) — same
  // shape the legacy live-fetch route uses, so cached entries carry
  // over.
  const cacheKeys = drafts.map((d) =>
    makeCacheKey(opts.iso2, d.longTitle ?? d.title),
  );
  const cached = await (opts.readSummaries ?? readCachedSummaries)(db, cacheKeys);
  const missingIdx = cached
    .map((s, i) => (s === null ? i : -1))
    .filter((i) => i >= 0);

  let summarisedCount = 0;
  if (missingIdx.length > 0) {
    const generated = await (opts.generateSummaries ?? generateSummariesBatch)(
      missingIdx.map((i) => ({
        promptTitle: drafts[i].longTitle ?? drafts[i].title,
      })),
    );
    await Promise.all(
      missingIdx.map(async (origIdx, genIdx) => {
        const summary = generated[genIdx];
        if (summary) {
          cached[origIdx] = summary;
          if (!opts.dryRun) await (opts.cacheSummary ?? writeCachedSummary)(db, cacheKeys[origIdx], summary);
          summarisedCount++;
        }
      }),
    );
  }

  // Materialise BillIngest[] with the resolved summary.
  const rows: BillIngest[] = drafts.map((d, i) => ({
    jurisdictionId: d.jurisdictionId,
    bodyId: d.bodyId,
    sourceId: d.sourceId,
    externalId: d.externalId,
    title: d.title,
    longTitle: d.longTitle,
    summary: cached[i] ?? d.summary ?? null,
    stage: d.stage,
    rawStatus: d.rawStatus,
    introducedDate: d.introducedDate,
    lastActionDate: d.lastActionDate,
    lastActionText: d.lastActionText,
    sponsorName: d.sponsorName,
    sponsorParty: d.sponsorParty,
    url: d.url,
    textUrl: d.textUrl,
    voteYes: d.voteYes,
    voteNo: d.voteNo,
    voteAbstain: d.voteAbstain,
    raw: d.raw,
  }));

  const result = await (opts.writeRows ?? upsertBills)(db, rows, { dryRun: opts.dryRun });

  return {
    jurisdictionId,
    fetched: drafts.length,
    inserted: result.inserted,
    updated: result.updated,
    unchanged: result.unchanged,
    wouldWrite: result.wouldWrite,
    summarised: summarisedCount,
    sourceOutcomes,
    sourcesStamped: result.sourcesStamped,
    dryRun: opts.dryRun ?? false,
  };
}
