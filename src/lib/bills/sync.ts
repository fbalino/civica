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
import type { BillIngest, BillIngestDraft } from "./types";

type Db = NeonHttpDatabase<typeof schema>;

export interface RunBillsSyncOptions {
  /** Country slug, e.g. "united-states". */
  jurisdictionSlug: string;
  /** ISO2 code, e.g. "US" — used as the cache-key prefix. */
  iso2: string;
  /** Source adapter call — receives the resolved jurisdictionId. */
  fetchDrafts: (opts: {
    jurisdictionId: string;
  }) => Promise<BillIngestDraft[]>;
}

export interface RunBillsSyncSummary {
  jurisdictionId: string;
  fetched: number;
  inserted: number;
  updated: number;
  summarised: number;
  sourcesStamped: string[];
}

export async function runBillsSync(
  db: Db,
  opts: RunBillsSyncOptions,
): Promise<RunBillsSyncSummary> {
  // Resolve jurisdiction UUID by slug.
  const j = await db
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
  const drafts = await opts.fetchDrafts({ jurisdictionId });

  // Batch-summarise. Cache key uses iso2 + (longTitle || title) — same
  // shape the legacy live-fetch route uses, so cached entries carry
  // over.
  const cacheKeys = drafts.map((d) =>
    makeCacheKey(opts.iso2, d.longTitle ?? d.title),
  );
  const cached = await readCachedSummaries(db, cacheKeys);
  const missingIdx = cached
    .map((s, i) => (s === null ? i : -1))
    .filter((i) => i >= 0);

  let summarisedCount = 0;
  if (missingIdx.length > 0) {
    const generated = await generateSummariesBatch(
      missingIdx.map((i) => ({
        promptTitle: drafts[i].longTitle ?? drafts[i].title,
      })),
    );
    await Promise.all(
      missingIdx.map(async (origIdx, genIdx) => {
        const summary = generated[genIdx];
        if (summary) {
          cached[origIdx] = summary;
          await writeCachedSummary(db, cacheKeys[origIdx], summary);
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

  const result = await upsertBills(db, rows);

  return {
    jurisdictionId,
    fetched: drafts.length,
    inserted: result.inserted,
    updated: result.updated,
    summarised: summarisedCount,
    sourcesStamped: result.sourcesStamped,
  };
}
