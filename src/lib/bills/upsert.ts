import { eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { bills, sources } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { BillIngest } from "./types";

type Db = NeonHttpDatabase<typeof schema>;

export interface UpsertResult {
  inserted: number;
  updated: number;
  /** Source IDs whose `lastSyncAt` was stamped. */
  sourcesStamped: string[];
}

/**
 * Idempotent insert into the `bills` table, keyed by `(sourceId,
 * externalId)`. After a successful pass, stamps `sources.lastSyncAt =
 * NOW()` for every distinct source represented in `rows` — this is
 * the convention required by AGENTS.md and was previously unused
 * across the codebase.
 *
 * Drizzle's `onConflictDoUpdate` returns the row regardless of
 * whether it inserted or updated, so we count manually using
 * `xmax = 0` (Postgres-specific: 0 means the tuple was just
 * inserted).
 */
export async function upsertBills(
  db: Db,
  rows: BillIngest[],
): Promise<UpsertResult> {
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, sourcesStamped: [] };
  }

  let inserted = 0;
  let updated = 0;

  // Drizzle on Neon HTTP doesn't reliably surface (xmax = 0). Do
  // per-row upserts and detect insert-vs-update by checking the
  // existing row first. Cheap on the Neon HTTP driver because each
  // call is a single round-trip.
  for (const row of rows) {
    const existing = await db
      .select({ id: bills.id })
      .from(bills)
      .where(
        sql`${bills.sourceId} = ${row.sourceId} AND ${bills.externalId} = ${row.externalId}`,
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(bills)
        .set({
          jurisdictionId: row.jurisdictionId,
          bodyId: row.bodyId,
          title: row.title,
          longTitle: row.longTitle,
          summary: row.summary,
          stage: row.stage,
          rawStatus: row.rawStatus,
          introducedDate: row.introducedDate,
          lastActionDate: row.lastActionDate,
          lastActionText: row.lastActionText,
          sponsorName: row.sponsorName,
          sponsorParty: row.sponsorParty,
          url: row.url,
          textUrl: row.textUrl,
          voteYes: row.voteYes,
          voteNo: row.voteNo,
          voteAbstain: row.voteAbstain,
          raw: row.raw,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, existing[0].id));
      updated++;
    } else {
      await db.insert(bills).values({
        jurisdictionId: row.jurisdictionId,
        bodyId: row.bodyId,
        sourceId: row.sourceId,
        externalId: row.externalId,
        title: row.title,
        longTitle: row.longTitle,
        summary: row.summary,
        stage: row.stage,
        rawStatus: row.rawStatus,
        introducedDate: row.introducedDate,
        lastActionDate: row.lastActionDate,
        lastActionText: row.lastActionText,
        sponsorName: row.sponsorName,
        sponsorParty: row.sponsorParty,
        url: row.url,
        textUrl: row.textUrl,
        voteYes: row.voteYes,
        voteNo: row.voteNo,
        voteAbstain: row.voteAbstain,
        raw: row.raw,
      });
      inserted++;
    }
  }

  // Stamp lastSyncAt on every distinct source we just touched. AGENTS.md:
  // "Sync scripts MUST stamp `sources.last_sync_at = NOW()` on success."
  const sourcesStamped = Array.from(new Set(rows.map((r) => r.sourceId)));
  for (const sourceId of sourcesStamped) {
    await db
      .update(sources)
      .set({ lastSyncAt: new Date() })
      .where(eq(sources.id, sourceId));
  }

  return { inserted, updated, sourcesStamped };
}
