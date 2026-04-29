/**
 * Phase 5.5 — clustering / de-duplication.
 *
 * Pulls unclustered `raw_events` rows, embeds title+body, groups
 * near-duplicate records into governance-event clusters per spec §2.4:
 *
 *   - country must match (we don't cross-pollinate clusters across
 *     jurisdictions — events in different countries are different
 *     events even if textually similar)
 *   - event dates within ±48h of each other
 *   - cosine similarity above CLUSTER_SIM_THRESHOLD on the embeddings
 *
 * Algorithm: per-country bucket, then union-find with greedy
 * pairwise similarity. O(N²) per bucket, which is fine — buckets
 * rarely exceed 10–30 events/day.
 *
 * Rows without a resolved jurisdictionId are left unclustered. They
 * stay in the staging table for human review or later auto-resolution.
 */

import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { rawEvents } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { embedBatch, cosineSimilarity } from "./embed";

type Db = NeonHttpDatabase<typeof schema>;

/** Cosine-similarity threshold for grouping records into one cluster. */
export const CLUSTER_SIM_THRESHOLD = 0.75;

/** Date-window half-width in hours per spec §2.4. */
export const CLUSTER_DATE_WINDOW_HOURS = 48;

export interface ClusterRunSummary {
  /** Rows considered (unclustered + jurisdiction-resolved) */
  candidates: number;
  /** Rows that got a cluster_id assigned */
  clustered: number;
  /** Distinct cluster ids written */
  clustersCreated: number;
  /** Buckets that ran (one per country with ≥1 candidate) */
  countryBuckets: number;
  /** Rows with multi-source clusters (proves dedup) */
  multiSourceClusters: number;
}

interface CandidateRow {
  id: string;
  jurisdictionId: string;
  eventDate: string | null;
  title: string;
  body: string | null;
  sourceId: string;
}

/**
 * Run the clustering pipeline against all unclustered rows. Returns
 * a summary of what changed.
 */
export async function runClustering(
  db: Db,
  opts: { limit?: number } = {}
): Promise<ClusterRunSummary> {
  const limit = opts.limit ?? 1000;

  // Pull candidates: unclustered, with a resolved jurisdiction id.
  const candidates: CandidateRow[] = (await db
    .select({
      id: rawEvents.id,
      jurisdictionId: rawEvents.jurisdictionId,
      eventDate: rawEvents.eventDate,
      title: rawEvents.title,
      body: rawEvents.body,
      sourceId: rawEvents.sourceId,
    })
    .from(rawEvents)
    .where(
      and(
        isNull(rawEvents.clusterId),
        sql`${rawEvents.jurisdictionId} IS NOT NULL`
      )
    )
    .limit(limit)) as CandidateRow[];

  if (candidates.length === 0) {
    return {
      candidates: 0,
      clustered: 0,
      clustersCreated: 0,
      countryBuckets: 0,
      multiSourceClusters: 0,
    };
  }

  // Batch-embed all candidates in one pass — much faster than per-row.
  const texts = candidates.map((c) =>
    [c.title, c.body ?? ""].filter(Boolean).join(" — ").slice(0, 1500)
  );
  console.log(
    `[cluster] embedding ${candidates.length} candidates (this triggers model load on first run)…`
  );
  const embeddings = await embedBatch(texts);

  // Bucket by jurisdictionId
  const buckets = new Map<string, number[]>(); // jurisdictionId → indexes
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const arr = buckets.get(c.jurisdictionId) ?? [];
    arr.push(i);
    buckets.set(c.jurisdictionId, arr);
  }

  let clustered = 0;
  let clustersCreated = 0;
  let multiSourceClusters = 0;
  const now = new Date();

  for (const [jurisdictionId, indexes] of buckets) {
    // Within a country, greedy union-find on (date proximity & embedding sim).
    const parent = new Map<number, number>();
    for (const i of indexes) parent.set(i, i);
    const find = (i: number): number => {
      let p = i;
      while (parent.get(p)! !== p) p = parent.get(p)!;
      // Path compression
      let q = i;
      while (parent.get(q)! !== q) {
        const next = parent.get(q)!;
        parent.set(q, p);
        q = next;
      }
      return p;
    };
    const union = (i: number, j: number) => {
      const ri = find(i);
      const rj = find(j);
      if (ri !== rj) parent.set(ri, rj);
    };

    for (let a = 0; a < indexes.length; a++) {
      for (let b = a + 1; b < indexes.length; b++) {
        const ia = indexes[a];
        const ib = indexes[b];
        if (!withinDateWindow(candidates[ia].eventDate, candidates[ib].eventDate)) {
          continue;
        }
        const sim = cosineSimilarity(embeddings[ia], embeddings[ib]);
        if (sim >= CLUSTER_SIM_THRESHOLD) {
          union(ia, ib);
        }
      }
    }

    // Collect groups
    const groups = new Map<number, number[]>();
    for (const i of indexes) {
      const r = find(i);
      const arr = groups.get(r) ?? [];
      arr.push(i);
      groups.set(r, arr);
    }

    // Assign cluster ids and write back
    for (const [, members] of groups) {
      const clusterId = randomUUID();
      const sourceIds = new Set(members.map((idx) => candidates[idx].sourceId));
      if (sourceIds.size > 1) multiSourceClusters++;

      // Per-row update with the embedding + cluster_id stamped
      for (const idx of members) {
        await db
          .update(rawEvents)
          .set({
            embedding: embeddings[idx],
            clusterId,
            clusteredAt: now,
          })
          .where(eq(rawEvents.id, candidates[idx].id));
      }
      clustered += members.length;
      clustersCreated++;
    }

    void jurisdictionId; // jurisdictionId loop var used implicitly via bucket
  }

  return {
    candidates: candidates.length,
    clustered,
    clustersCreated,
    countryBuckets: buckets.size,
    multiSourceClusters,
  };
}

function withinDateWindow(
  a: string | null,
  b: string | null
): boolean {
  // Missing dates → treat as same day (worst case: they're in the same
  // country and look textually similar; let the human reviewer split
  // them later if needed).
  if (!a || !b) return true;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return true;
  const hours = Math.abs(da - db) / (1000 * 60 * 60);
  return hours <= CLUSTER_DATE_WINDOW_HOURS;
}
