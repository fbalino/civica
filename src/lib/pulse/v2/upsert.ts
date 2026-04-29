/**
 * Phase 5.5 — staging-table upsert helper.
 *
 * Idempotent insert into `raw_events`, keyed by `(sourceId, externalId)`
 * when externalId is non-null, and by `(sourceId, sourceUrl, eventDate)`
 * otherwise. After a successful pass, stamps `sources.last_sync_at =
 * NOW()` for every distinct source — required by AGENTS.md.
 *
 * Pattern mirrors `src/lib/bills/upsert.ts`.
 */

import { and, eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { rawEvents, sources } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { RawEventInput } from "./types";

type Db = NeonHttpDatabase<typeof schema>;

export interface UpsertResult {
  inserted: number;
  /** Rows skipped because an identical (sourceId, externalId) row exists. */
  skippedDuplicate: number;
  /** Source IDs whose `lastSyncAt` was stamped. */
  sourcesStamped: string[];
}

/**
 * Insert raw events into the staging table. Existing rows (matched by
 * externalId where present) are left alone — we treat the staging table
 * as append-only to keep the embedding + clustering work cheap. The
 * cleanup script drops rows older than 7 days post-clustering.
 */
export async function upsertRawEvents(
  db: Db,
  rows: RawEventInput[]
): Promise<UpsertResult> {
  if (rows.length === 0) {
    return { inserted: 0, skippedDuplicate: 0, sourcesStamped: [] };
  }

  let inserted = 0;
  let skippedDuplicate = 0;

  for (const row of rows) {
    const externalId = row.externalId ?? null;

    if (externalId) {
      const existing = await db
        .select({ id: rawEvents.id })
        .from(rawEvents)
        .where(
          and(
            eq(rawEvents.sourceId, row.sourceId),
            eq(rawEvents.externalId, externalId)
          )
        )
        .limit(1);

      if (existing[0]) {
        skippedDuplicate++;
        continue;
      }
    } else if (row.sourceUrl) {
      // No external id — fall back to (sourceId, sourceUrl) for dedup.
      const existing = await db
        .select({ id: rawEvents.id })
        .from(rawEvents)
        .where(
          and(
            eq(rawEvents.sourceId, row.sourceId),
            eq(rawEvents.sourceUrl, row.sourceUrl)
          )
        )
        .limit(1);

      if (existing[0]) {
        skippedDuplicate++;
        continue;
      }
    }

    await db.insert(rawEvents).values({
      sourceId: row.sourceId,
      externalId,
      sourceUrl: row.sourceUrl ?? null,
      sourceType: row.sourceType,
      jurisdictionId: row.jurisdictionId ?? null,
      rawCountryName: row.rawCountryName ?? null,
      eventDate: row.eventDate ?? null,
      title: row.title,
      body: row.body ?? null,
      raw: row.raw,
    });
    inserted++;
  }

  // Stamp lastSyncAt on every distinct source we just touched.
  const sourcesStamped = Array.from(new Set(rows.map((r) => r.sourceId)));
  for (const sourceId of sourcesStamped) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, sourceId));
  }

  return { inserted, skippedDuplicate, sourcesStamped };
}

/**
 * Garbage-collect raw_events rows that have already been clustered and
 * are older than `olderThanDays` (default 7). Run from a maintenance
 * script — not in the daily ingest loop. Returns count of rows deleted.
 */
export async function gcClusteredRawEvents(
  db: Db,
  olderThanDays = 7
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(rawEvents)
    .where(
      and(
        sql`${rawEvents.clusteredAt} IS NOT NULL`,
        sql`${rawEvents.clusteredAt} < ${cutoff.toISOString()}`
      )
    )
    .returning({ id: rawEvents.id });
  return result.length;
}
