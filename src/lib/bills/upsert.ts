import { eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { bills } from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import type * as schema from "@/lib/db/schema";
import type { BillIngest } from "./types";

type Db = NeonHttpDatabase<typeof schema>;

export interface UpsertResult {
  inserted: number;
  updated: number;
  unchanged: number;
  wouldWrite: number;
  dryRun: boolean;
  /** Source IDs whose `lastSyncAt` was stamped. */
  sourcesStamped: string[];
}

export interface UpsertBillsOptions {
  dryRun?: boolean;
  now?: Date;
  stampSources?: typeof markSourcesSynced;
}

export function billIngestErrors(row: BillIngest): string[] {
  const errors: string[] = [];
  if (!row.jurisdictionId.trim()) errors.push("jurisdictionId is required");
  if (!row.sourceId.trim()) errors.push("sourceId is required");
  if (!row.externalId.trim()) errors.push("externalId is required");
  if (!row.title.trim()) errors.push("title is required");
  if (!Number.isSafeInteger(row.stage) || row.stage < 0 || row.stage > 4) errors.push("stage must be an integer from 0 to 4");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.lastActionDate)) errors.push("lastActionDate must use YYYY-MM-DD");
  if (row.introducedDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.introducedDate)) errors.push("introducedDate must use YYYY-MM-DD");
  try {
    const url = new URL(row.url);
    if (url.protocol !== "https:") errors.push("url must use HTTPS");
  } catch {
    errors.push("url must be absolute");
  }
  return errors;
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
  options: UpsertBillsOptions = {},
): Promise<UpsertResult> {
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, unchanged: 0, wouldWrite: 0, dryRun: options.dryRun ?? false, sourcesStamped: [] };
  }

  const keys = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const errors = billIngestErrors(row);
    if (errors.length) throw new Error(`Invalid bill at index ${index}: ${errors.join("; ")}`);
    const key = `${row.sourceId}::${row.externalId}`;
    if (keys.has(key)) throw new Error(`Duplicate bill input key: ${key}`);
    keys.add(key);
  }

  if (options.dryRun) {
    return { inserted: 0, updated: 0, unchanged: 0, wouldWrite: rows.length, dryRun: true, sourcesStamped: [] };
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  // Drizzle on Neon HTTP doesn't reliably surface (xmax = 0). Do
  // per-row upserts and detect insert-vs-update by checking the
  // existing row first. Cheap on the Neon HTTP driver because each
  // call is a single round-trip.
  for (const row of rows) {
    const existing = await db
      .select()
      .from(bills)
      .where(
        sql`${bills.sourceId} = ${row.sourceId} AND ${bills.externalId} = ${row.externalId}`,
      )
      .limit(1);

    if (existing[0]) {
      if (billMatches(existing[0], row)) {
        unchanged++;
        continue;
      }
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
          updatedAt: options.now ?? new Date(),
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

  // Stamp lastSyncAt on every distinct source we just touched — but only
  // when at least one row was written. markSourcesSynced
  // (src/lib/db/source-freshness.ts) is the one sanctioned path: it stamps
  // iff rowsWritten > 0 and returns the ids it actually stamped. AGENTS.md:
  // "Sync scripts MUST stamp `sources.last_sync_at = NOW()` on success."
  const sourcesStamped = await (options.stampSources ?? markSourcesSynced)(
    Array.from(new Set(rows.map((r) => r.sourceId))),
    { rowsWritten: inserted + updated, executor: db },
  );

  return { inserted, updated, unchanged, wouldWrite: inserted + updated, dryRun: false, sourcesStamped };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function billMatches(existing: typeof bills.$inferSelect, row: BillIngest): boolean {
  return existing.jurisdictionId === row.jurisdictionId &&
    existing.bodyId === row.bodyId &&
    existing.sourceId === row.sourceId &&
    existing.externalId === row.externalId &&
    existing.title === row.title &&
    existing.longTitle === row.longTitle &&
    existing.summary === row.summary &&
    existing.stage === row.stage &&
    existing.rawStatus === row.rawStatus &&
    existing.introducedDate === row.introducedDate &&
    existing.lastActionDate === row.lastActionDate &&
    existing.lastActionText === row.lastActionText &&
    existing.sponsorName === row.sponsorName &&
    existing.sponsorParty === row.sponsorParty &&
    existing.url === row.url &&
    existing.textUrl === row.textUrl &&
    existing.voteYes === row.voteYes &&
    existing.voteNo === row.voteNo &&
    existing.voteAbstain === row.voteAbstain &&
    stableJson(existing.raw) === stableJson(row.raw);
}
