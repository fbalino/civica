/**
 * Phase 5.5 — staging-table upsert helper.
 *
 * Idempotent insert into `raw_events`, keyed by `(sourceId, externalId)`
 * when externalId is non-null, and by `(sourceId, sourceUrl, eventDate)`
 * otherwise. Freshness (`sources.last_sync_at`) is stamped via the
 * sanctioned `markSourcesSynced()` helper, and ONLY when this run actually
 * inserted new rows — a duplicate-only pass must never fake freshness.
 *
 * Pattern mirrors `src/lib/bills/upsert.ts`.
 */

import { and, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { rawEvents } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
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

  // Stamp lastSyncAt via the sanctioned helper — ONLY when this run
  // actually inserted new rows. A duplicate-only daily run (inserted === 0)
  // must not advance freshness on every source it merely re-checked.
  const sourcesStamped = await markSourcesSynced(
    Array.from(new Set(rows.map((r) => r.sourceId))),
    { rowsWritten: inserted, executor: db }
  );

  return { inserted, skippedDuplicate, sourcesStamped };
}
