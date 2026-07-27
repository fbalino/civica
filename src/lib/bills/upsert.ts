import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { bills } from "@/lib/db/schema";
import { markSourcesSyncedFromInsertedRowsCte } from "@/lib/db/source-freshness";
import type * as schema from "@/lib/db/schema";
import type { BillIngest } from "./types";

type Db = NeonHttpDatabase<typeof schema>;
type AtomicExecutor = Pick<Db, "execute">;

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
  /** Deterministic failure/retry seam. Production callers omit this. */
  atomicWrite?: AtomicBillWriter;
  /** Deterministic planning-read seam. Production callers omit this. */
  readExisting?: (
    db: Pick<Db, "select">,
    row: BillIngest,
  ) => Promise<typeof bills.$inferSelect | null>;
}

export interface PlannedBillWrite {
  ordinal: number;
  operation: "insert" | "update";
  existingId: string | null;
  row: BillIngest;
}

export interface AtomicBillWriteResult {
  inserted: number;
  updated: number;
  sourcesStamped: string[];
}

export type AtomicBillWriter = (
  db: AtomicExecutor,
  writes: readonly PlannedBillWrite[],
  committedAt: Date,
) => Promise<AtomicBillWriteResult>;

export function billIngestErrors(row: BillIngest): string[] {
  const errors: string[] = [];
  if (!row.jurisdictionId.trim()) errors.push("jurisdictionId is required");
  if (!row.sourceId.trim()) errors.push("sourceId is required");
  if (!row.externalId.trim()) errors.push("externalId is required");
  if (!row.title.trim()) errors.push("title is required");
  if (!Number.isSafeInteger(row.stage) || row.stage < 0 || row.stage > 4)
    errors.push("stage must be an integer from 0 to 4");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.lastActionDate))
    errors.push("lastActionDate must use YYYY-MM-DD");
  if (row.introducedDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.introducedDate))
    errors.push("introducedDate must use YYYY-MM-DD");
  try {
    const url = new URL(row.url);
    if (url.protocol !== "https:") errors.push("url must use HTTPS");
  } catch {
    errors.push("url must be absolute");
  }
  return errors;
}

/**
 * Plan idempotent changes using the job-lease-serialized snapshot, then commit
 * every bill write and eligible source-freshness stamp in one PostgreSQL
 * statement. A uniqueness race, missing planned update, or final freshness
 * failure aborts the whole statement, so retrying the same input can never get
 * stranded behind already-committed bill rows and an unstamped source.
 */
export async function upsertBills(
  db: Db,
  rows: BillIngest[],
  options: UpsertBillsOptions = {},
): Promise<UpsertResult> {
  if (rows.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      unchanged: 0,
      wouldWrite: 0,
      dryRun: options.dryRun ?? false,
      sourcesStamped: [],
    };
  }

  const keys = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const errors = billIngestErrors(row);
    if (errors.length)
      throw new Error(`Invalid bill at index ${index}: ${errors.join("; ")}`);
    const key = `${row.sourceId}::${row.externalId}`;
    if (keys.has(key)) throw new Error(`Duplicate bill input key: ${key}`);
    keys.add(key);
  }

  if (options.dryRun) {
    return {
      inserted: 0,
      updated: 0,
      unchanged: 0,
      wouldWrite: rows.length,
      dryRun: true,
      sourcesStamped: [],
    };
  }

  let unchanged = 0;
  const plannedWrites: PlannedBillWrite[] = [];

  // Classify rows with read-only lookups. No mutation happens until the
  // complete plan crosses the one-statement atomic boundary below.
  for (const row of rows) {
    const existingRow = options.readExisting
      ? await options.readExisting(db, row)
      : (
          await db
            .select()
            .from(bills)
            .where(
              sql`${bills.sourceId} = ${row.sourceId} AND ${bills.externalId} = ${row.externalId}`,
            )
            .limit(1)
        )[0];

    if (existingRow) {
      if (billMatches(existingRow, row)) {
        unchanged++;
        continue;
      }
      plannedWrites.push({
        ordinal: plannedWrites.length,
        operation: "update",
        existingId: existingRow.id,
        row,
      });
    } else {
      plannedWrites.push({
        ordinal: plannedWrites.length,
        operation: "insert",
        existingId: null,
        row,
      });
    }
  }

  if (plannedWrites.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      unchanged,
      wouldWrite: 0,
      dryRun: false,
      sourcesStamped: [],
    };
  }

  const committedAt = options.now ?? new Date();
  const atomic = await (options.atomicWrite ?? executeAtomicBillWrites)(
    db,
    plannedWrites,
    committedAt,
  );

  return {
    inserted: atomic.inserted,
    updated: atomic.updated,
    unchanged,
    wouldWrite: atomic.inserted + atomic.updated,
    dryRun: false,
    sourcesStamped: atomic.sourcesStamped,
  };
}

/**
 * One-statement Bills publish for Neon HTTP. Planning reads happen before this
 * boundary under the cron's job-wide lease; only this function mutates state.
 */
export const executeAtomicBillWrites: AtomicBillWriter = async (
  db,
  writes,
  committedAt,
) => {
  if (writes.length === 0) {
    return { inserted: 0, updated: 0, sourcesStamped: [] };
  }
  if (!Number.isFinite(committedAt.getTime())) {
    throw new RangeError("Bills atomic commit timestamp is invalid");
  }

  const prepared = writes.map(({ ordinal, operation, existingId, row }) => ({
    ordinal,
    operation,
    existingId,
    ...row,
  }));
  const expectedSources = new Set(writes.map(({ row }) => row.sourceId)).size;
  const freshnessCte = markSourcesSyncedFromInsertedRowsCte(committedAt);

  const result = await db.execute(sql`
    WITH input_rows AS (
      SELECT *
      FROM jsonb_to_recordset(${JSON.stringify(prepared)}::jsonb) AS input(
        ordinal integer,
        operation text,
        "existingId" uuid,
        "jurisdictionId" uuid,
        "bodyId" uuid,
        "sourceId" text,
        "externalId" text,
        title text,
        "longTitle" text,
        summary text,
        stage integer,
        "rawStatus" text,
        "introducedDate" date,
        "lastActionDate" date,
        "lastActionText" text,
        "sponsorName" text,
        "sponsorParty" text,
        url text,
        "textUrl" text,
        "voteYes" integer,
        "voteNo" integer,
        "voteAbstain" integer,
        raw jsonb
      )
    ), inserted_bills AS (
      INSERT INTO bills (
        jurisdiction_id,
        body_id,
        source_id,
        external_id,
        title,
        long_title,
        summary,
        stage,
        raw_status,
        introduced_date,
        last_action_date,
        last_action_text,
        sponsor_name,
        sponsor_party,
        url,
        text_url,
        vote_yes,
        vote_no,
        vote_abstain,
        raw
      )
      SELECT
        input."jurisdictionId",
        input."bodyId",
        input."sourceId",
        input."externalId",
        input.title,
        input."longTitle",
        input.summary,
        input.stage,
        input."rawStatus",
        input."introducedDate",
        input."lastActionDate",
        input."lastActionText",
        input."sponsorName",
        input."sponsorParty",
        input.url,
        input."textUrl",
        input."voteYes",
        input."voteNo",
        input."voteAbstain",
        input.raw
      FROM input_rows input
      WHERE input.operation = 'insert'
      ORDER BY input.ordinal
      RETURNING id, source_id
    ), updated_bills AS (
      UPDATE bills bill
      SET
        jurisdiction_id = input."jurisdictionId",
        body_id = input."bodyId",
        title = input.title,
        long_title = input."longTitle",
        summary = input.summary,
        stage = input.stage,
        raw_status = input."rawStatus",
        introduced_date = input."introducedDate",
        last_action_date = input."lastActionDate",
        last_action_text = input."lastActionText",
        sponsor_name = input."sponsorName",
        sponsor_party = input."sponsorParty",
        url = input.url,
        text_url = input."textUrl",
        vote_yes = input."voteYes",
        vote_no = input."voteNo",
        vote_abstain = input."voteAbstain",
        raw = input.raw,
        updated_at = ${committedAt}
      FROM input_rows input
      WHERE input.operation = 'update'
        AND bill.id = input."existingId"
        AND bill.source_id = input."sourceId"
        AND bill.external_id = input."externalId"
      RETURNING bill.id, bill.source_id
    ), written_bills AS (
      SELECT id, source_id, 'inserted'::text AS outcome
      FROM inserted_bills
      UNION ALL
      SELECT id, source_id, 'updated'::text AS outcome
      FROM updated_bills
    ), inserted_source_rows AS (
      SELECT DISTINCT source_id
      FROM written_bills
    ), ${freshnessCte}, atomic_guard AS (
      SELECT 1 / CASE
        WHEN (SELECT count(*) FROM written_bills) = ${writes.length}
          AND (SELECT count(*) FROM stamped_sources) = ${expectedSources}
          THEN 1
        ELSE 0
      END AS ok
    )
    SELECT
      count(*) FILTER (WHERE outcome = 'inserted')::integer AS inserted,
      count(*) FILTER (WHERE outcome = 'updated')::integer AS updated,
      COALESCE(
        ARRAY(SELECT id FROM stamped_sources ORDER BY id),
        ARRAY[]::text[]
      ) AS sources_stamped,
      (SELECT ok FROM atomic_guard) AS guard_ok
    FROM written_bills
  `);

  const resultRows = ((result as unknown as { rows?: unknown[] }).rows ??
    result) as Array<Record<string, unknown>>;
  const summary = resultRows[0] ?? {};

  return {
    inserted: Number(summary.inserted ?? 0),
    updated: Number(summary.updated ?? 0),
    sourcesStamped: parseTextArray(summary.sources_stamped),
  };
};

function parseTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (
    typeof value === "string" &&
    value.startsWith("{") &&
    value.endsWith("}")
  ) {
    return value.slice(1, -1).split(",").filter(Boolean);
  }
  return [];
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

function billMatches(
  existing: typeof bills.$inferSelect,
  row: BillIngest,
): boolean {
  return (
    existing.jurisdictionId === row.jurisdictionId &&
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
    stableJson(existing.raw) === stableJson(row.raw)
  );
}
