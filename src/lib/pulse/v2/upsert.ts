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

export function rawEventInputErrors(row: RawEventInput): string[] {
  const errors: string[] = [];
  if (!row.sourceId.trim()) errors.push("sourceId is required");
  if (row.sourceType !== "specialist" && row.sourceType !== "news") {
    errors.push("sourceType must be specialist or news");
  }
  if (!row.title.trim()) errors.push("title is required");
  if (!row.externalId?.trim() && !row.sourceUrl?.trim()) {
    errors.push("externalId or sourceUrl is required for idempotent ingestion");
  }
  if (row.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.eventDate)) {
    errors.push("eventDate must use YYYY-MM-DD");
  }
  if (!row.raw || typeof row.raw !== "object" || Array.isArray(row.raw)) {
    errors.push("raw must be a JSON object");
  }
  return errors;
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

  for (const [index, row] of rows.entries()) {
    const errors = rawEventInputErrors(row);
    if (errors.length) {
      throw new Error(`Invalid raw event at index ${index}: ${errors.join("; ")}`);
    }
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
