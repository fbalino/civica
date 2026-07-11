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
 *   - cosine similarity above CLUSTER_SIM_THRESHOLD on the embeddings;
 *     when embeddings are unavailable, lexical Jaccard similarity is used
 *     with the separate LEXICAL_SIM_THRESHOLD fallback
 *
 * Algorithm: per-country bucket, then union-find with greedy
 * pairwise similarity. O(N²) per bucket, which is fine — buckets
 * rarely exceed 10–30 events/day.
 *
 * Rows without a resolved jurisdictionId are left unclustered. They
 * stay in the staging table for human review or later auto-resolution.
 */

import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { rawEvents } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { tryEmbedBatch, cosineSimilarity, lexicalSimilarity } from "./embed";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  startPulsePipelineRun,
  type PulsePipelineRunRef,
} from "./pipeline-version";

// Jaccard threshold for the lexical fallback — a pair of stories sharing this
// fraction of their significant tokens is treated as the same event. Higher
// than the cosine threshold because token overlap is a coarser signal.
const LEXICAL_SIM_THRESHOLD = 0.5;

type Db = NeonHttpDatabase<typeof schema>;

/** Cosine-similarity threshold for grouping records into one cluster. */
export const CLUSTER_SIM_THRESHOLD = 0.75;

/** Date-window half-width in hours per spec §2.4. */
export const CLUSTER_DATE_WINDOW_HOURS = 48;

export interface ClusterRunSummary {
  runId: string;
  versionKey: string;
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
  dryRun: boolean;
  assignments: Array<{ clusterId: string; memberIds: string[] }>;
}

export interface CandidateRow {
  id: string;
  jurisdictionId: string;
  eventDate: string | null;
  title: string;
  body: string | null;
  sourceId: string;
  ingestRunId: string;
}

export interface ClusterRunOptions {
  limit?: number;
  dryRun?: boolean;
  /** Fixture seam: bypasses the database candidate read. */
  candidates?: CandidateRow[];
  /** Fixture seam: null forces lexical clustering; an array supplies vectors. */
  embeddingResult?: number[][] | null;
  now?: Date;
  clusterIdFactory?: (memberIds: readonly string[]) => string;
  runRef?: PulsePipelineRunRef;
}

function deterministicFixtureClusterId(memberIds: readonly string[]): string {
  const hash = createHash("sha256")
    .update([...memberIds].sort().join("\n"))
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function validateCandidates(candidates: readonly CandidateRow[]): void {
  const ids = new Set<string>();
  for (const [index, candidate] of candidates.entries()) {
    if (!candidate.id.trim() || !candidate.jurisdictionId.trim() || !candidate.title.trim() || !candidate.ingestRunId.trim()) {
      throw new Error(`Invalid cluster candidate at index ${index}: id, jurisdictionId, title, and ingestRunId are required`);
    }
    if (ids.has(candidate.id)) {
      throw new Error(`Invalid cluster fixture: duplicate candidate id ${candidate.id}`);
    }
    ids.add(candidate.id);
  }
}

/**
 * Run the clustering pipeline against all unclustered rows. Returns
 * a summary of what changed.
 */
export async function runClustering(
  db: Db,
  opts: ClusterRunOptions = {},
): Promise<ClusterRunSummary> {
  const limit = opts.limit ?? 1000;

  // Pull candidates: unclustered, with a resolved jurisdiction id.
  const candidates: CandidateRow[] =
    opts.candidates ??
    ((await db
      .select({
        id: rawEvents.id,
        jurisdictionId: rawEvents.jurisdictionId,
        eventDate: rawEvents.eventDate,
        title: rawEvents.title,
        body: rawEvents.body,
        sourceId: rawEvents.sourceId,
        ingestRunId: rawEvents.ingestRunId,
      })
      .from(rawEvents)
      .where(
        and(
          isNull(rawEvents.clusterId),
          sql`${rawEvents.jurisdictionId} IS NOT NULL`,
        ),
      )
      .limit(limit)) as CandidateRow[]);

  validateCandidates(candidates);
  const run =
    opts.runRef ??
    createPulsePipelineRunRef("cluster", {
      sourceIds: candidates.length
        ? candidates.map(({ sourceId }) => sourceId)
        : undefined,
      upstreamRunIds: candidates.map(({ ingestRunId }) => ingestRunId),
    });
  const persistRun = !opts.dryRun && !opts.candidates && !opts.runRef;
  if (persistRun) await startPulsePipelineRun(db, run);

  if (candidates.length === 0) {
    if (persistRun) {
      await finishPulsePipelineRun(db, run.id, {
        status: "completed",
        counts: { candidates: 0, clustered: 0, clustersCreated: 0 },
      });
    }
    return {
      runId: run.id,
      versionKey: run.versionKey,
      candidates: 0,
      clustered: 0,
      clustersCreated: 0,
      countryBuckets: 0,
      multiSourceClusters: 0,
      dryRun: opts.dryRun ?? false,
      assignments: [],
    };
  }

  // Batch-embed all candidates in one pass — much faster than per-row.
  const texts = candidates.map((c) =>
    [c.title, c.body ?? ""].filter(Boolean).join(" — ").slice(0, 1500)
  );
  console.log(
    `[cluster] embedding ${candidates.length} candidates (this triggers model load on first run)…`
  );
  // Semantic embeddings when the local model loads; null on serverless where
  // the ONNX native runtime is absent — then similarity is lexical (Jaccard).
  const embeddings =
    "embeddingResult" in opts
      ? (opts.embeddingResult ?? null)
      : await tryEmbedBatch(texts);
  const useEmbeddings = embeddings !== null;
  console.log(
    `[cluster] similarity mode: ${useEmbeddings ? "semantic embeddings" : "lexical (embedding model unavailable)"}`
  );

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
  const now = opts.now ?? new Date();
  const assignments: ClusterRunSummary["assignments"] = [];

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
        const sim = useEmbeddings
          ? cosineSimilarity(embeddings![ia], embeddings![ib])
          : lexicalSimilarity(texts[ia], texts[ib]);
        const threshold = useEmbeddings
          ? CLUSTER_SIM_THRESHOLD
          : LEXICAL_SIM_THRESHOLD;
        if (sim >= threshold) {
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
      const memberIds = members.map((idx) => candidates[idx].id).sort();
      const clusterId =
        opts.clusterIdFactory?.(memberIds) ??
        (opts.dryRun ? deterministicFixtureClusterId(memberIds) : randomUUID());
      assignments.push({ clusterId, memberIds });
      const sourceIds = new Set(members.map((idx) => candidates[idx].sourceId));
      if (sourceIds.size > 1) multiSourceClusters++;

      // Per-row update with the embedding + cluster_id stamped
      for (const idx of members) {
        if (!opts.dryRun) {
          await db
            .update(rawEvents)
            .set({
              embedding: useEmbeddings ? embeddings![idx] : null,
              clusterId,
              clusteredAt: now,
              clusterRunId: run.id,
            })
            .where(eq(rawEvents.id, candidates[idx].id));
        }
      }
      clustered += members.length;
      clustersCreated++;
    }

    void jurisdictionId; // jurisdictionId loop var used implicitly via bucket
  }

  if (persistRun) {
    await finishPulsePipelineRun(db, run.id, {
      status: useEmbeddings ? "completed" : "partial",
      counts: {
        candidates: candidates.length,
        clustered,
        clustersCreated,
        multiSourceClusters,
      },
      failures: useEmbeddings
        ? []
        : [
            {
              component: "embedding",
              message: "Embedding runtime unavailable; lexical fallback used.",
            },
          ],
    });
  }

  return {
    runId: run.id,
    versionKey: run.versionKey,
    candidates: candidates.length,
    clustered,
    clustersCreated,
    countryBuckets: buckets.size,
    multiSourceClusters,
    dryRun: opts.dryRun ?? false,
    assignments: assignments.sort((left, right) => left.clusterId.localeCompare(right.clusterId)),
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
