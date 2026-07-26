/**
 * source-freshness — the ONE sanctioned way to stamp
 * `sources.last_sync_at`.
 *
 * Provenance is load-bearing in Civica: every data point traces to a
 * source row with a `last_sync_at`. A failed or empty sync must NEVER
 * look fresh (AGENTS.md provenance invariant). This module is the only
 * place allowed to write `sources.last_sync_at`; the stamp is applied
 * exclusively when a run actually wrote data.
 *
 * Enforced repo-wide by `npm run validate:sync-freshness`, which fails
 * the build if any code outside this module (plus a tiny owned-elsewhere
 * allowlist) writes `last_sync_at` directly.
 *
 * Usage — factbook reconcile adapter (passes its own executor):
 *
 *   await markSourcesSynced("imf_weo", {
 *     rowsWritten: totalWritten,
 *     dryRun: options.dryRun,
 *     executor: db,
 *   });
 *
 * Usage — standalone tsx sync script (default executor):
 *
 *   await markSourcesSynced(SOURCE_ID, { rowsWritten: inserted });
 *
 * Usage — multi-source sync inside a transaction:
 *
 *   await db.transaction(async (tx) => {
 *     // ...writes...
 *     await markSourcesSynced([srcA, srcB], { rowsWritten, executor: tx });
 *   });
 *
 * Usage — defer several stage stamps until the whole job succeeds:
 *
 *   const freshness = createDeferredSourceFreshness();
 *   await runStage({ markSynced: freshness.capture });
 *   await runAnotherStage({ markSynced: freshness.capture });
 *   // Call only after every stage has succeeded.
 *   await freshness.flush({ executor: db });
 *
 * A transactional publisher whose rows use PostgreSQL timestamp defaults can
 * instead flush with `{ executor: tx, timestampSource: "database" }`.
 */
import { eq, inArray, sql, type SQL } from "drizzle-orm";
import type { NeonQueryFunctionInTransaction } from "@neondatabase/serverless";

import { db } from "./index";
import { sources } from "./schema";

/**
 * Anything that can run an `UPDATE sources` — the shared `db` client or
 * a transaction handle from `db.transaction(...)`. Defaulting to `db`
 * lets transaction callers pass their `tx` while everyone else omits it.
 */
export type SourceFreshnessExecutor =
  typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface MarkSourcesSyncedOptions {
  /**
   * Number of rows the sync actually wrote this run. The freshness
   * stamp is applied ONLY when this is greater than 0 — an empty run
   * must not advance `last_sync_at`.
   */
  rowsWritten: number;
  /**
   * When true, skip the stamp entirely. Dry runs never write and never
   * fake freshness.
   */
  dryRun?: boolean;
  /**
   * Timestamp to stamp. Defaults to `new Date()` from the application clock.
   * Pass an explicit value to align the stamp with a run's `retrievedAt`.
   */
  at?: Date;
  /**
   * Clock used for the stamp. Existing callers default to the application
   * clock. Transactional publishers can select the database clock so their
   * freshness stamp shares PostgreSQL's CURRENT_TIMESTAMP with row defaults
   * created in the same transaction.
   */
  timestampSource?: "application" | "database";
  /**
   * Executor to run the UPDATE against. Defaults to the shared `db`
   * client, so transaction callers can pass their `tx` and everyone
   * else can omit it.
   */
  executor?: SourceFreshnessExecutor;
}

export type DeferredSourceFreshnessCaptureOptions = Pick<
  MarkSourcesSyncedOptions,
  "rowsWritten" | "dryRun"
>;

export type DeferredSourceFreshnessFlushOptions = Pick<
  MarkSourcesSyncedOptions,
  "at" | "executor" | "timestampSource"
>;

export interface DeferredSourceFreshness {
  /**
   * Record one stage's eligible source ids and row count without stamping.
   * The empty result is intentional: no source has been stamped yet.
   */
  capture: (
    sourceIds: string | string[],
    options: DeferredSourceFreshnessCaptureOptions,
  ) => Promise<string[]>;
  /**
   * Stamp the accumulated source set in one `markSourcesSynced()` call.
   * The first call fixes the timestamp source, timestamp, and executor; every
   * later call returns that same promise, so one accumulator can never issue
   * a second stamp.
   */
  flush: (options?: DeferredSourceFreshnessFlushOptions) => Promise<string[]>;
}

function hasEligibleRows(rowsWritten: number, dryRun = false): boolean {
  return !dryRun && Number.isSafeInteger(rowsWritten) && rowsWritten > 0;
}

function normalizeSourceIds(sourceIds: string | string[]): string[] {
  return Array.from(
    new Set(
      (Array.isArray(sourceIds) ? sourceIds : [sourceIds])
        .map((id) => id.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

/**
 * Collect source-freshness claims from multiple stages and stamp only after
 * the caller explicitly confirms the whole job succeeded by calling `flush`.
 *
 * `capture` is compatible with adapters' `markSynced` callback: it preserves
 * the same dry-run/positive-safe-integer eligibility rule, but deliberately
 * returns an empty array because it has not stamped anything. Source ids stay
 * in first-seen order and row counts are added once per eligible capture.
 *
 * `flush` snapshots the aggregate and delegates once to `markSourcesSynced`.
 * Repeated or concurrent flushes share the first promise (including a cached
 * rejection), and captures after flushing begins are rejected.
 */
export function createDeferredSourceFreshness(): DeferredSourceFreshness {
  const sourceIds = new Set<string>();
  let rowsWritten = 0;
  let flushPromise: Promise<string[]> | undefined;

  const capture: DeferredSourceFreshness["capture"] = (
    capturedSourceIds,
    options,
  ) => {
    if (flushPromise) {
      throw new Error(
        "Cannot capture source freshness after flush has started",
      );
    }

    const ids = normalizeSourceIds(capturedSourceIds);
    if (
      !hasEligibleRows(options.rowsWritten, options.dryRun) ||
      ids.length === 0
    ) {
      return Promise.resolve([]);
    }

    if (options.rowsWritten > Number.MAX_SAFE_INTEGER - rowsWritten) {
      throw new RangeError(
        "Deferred source freshness row count exceeds Number.MAX_SAFE_INTEGER",
      );
    }

    rowsWritten += options.rowsWritten;
    for (const id of ids) sourceIds.add(id);
    return Promise.resolve([]);
  };

  const flush: DeferredSourceFreshness["flush"] = (options = {}) => {
    if (!flushPromise) {
      const ids = [...sourceIds];
      const totalRowsWritten = rowsWritten;
      flushPromise = markSourcesSynced(ids, {
        rowsWritten: totalRowsWritten,
        at: options.at,
        executor: options.executor,
        timestampSource: options.timestampSource,
      });
    }
    return flushPromise;
  };

  return { capture, flush };
}

/**
 * Stamp `sources.last_sync_at` for the given source id(s) — but ONLY
 * when the sync actually wrote data this run.
 *
 * The stamp is applied iff `!dryRun && rowsWritten > 0 && ids.length > 0`.
 * Ids are de-duplicated; a single id uses `eq`, multiple use `inArray`.
 *
 * This is the ONLY sanctioned way to stamp `sources.last_sync_at`. A
 * failed/empty sync must never look fresh (AGENTS.md provenance
 * invariant). Do not write `last_sync_at` anywhere else — the
 * `validate:sync-freshness` guard will reject it.
 *
 * @returns the source ids that were actually stamped (empty array when
 *   the run was a dry run, wrote nothing, or had no ids).
 */
export async function markSourcesSynced(
  sourceIds: string | string[],
  opts: MarkSourcesSyncedOptions,
): Promise<string[]> {
  const {
    rowsWritten,
    dryRun = false,
    at,
    executor = db,
    timestampSource = "application",
  } = opts;

  // A dry run or an empty/failed sync must never advance freshness.
  if (!hasEligibleRows(rowsWritten, dryRun)) {
    return [];
  }

  const ids = normalizeSourceIds(sourceIds);
  if (ids.length === 0) return [];

  if (timestampSource === "database" && at) {
    throw new RangeError(
      "markSourcesSynced cannot combine an explicit timestamp with the database clock",
    );
  }
  const stampedAt =
    timestampSource === "database" ? sql`CURRENT_TIMESTAMP` : at ?? new Date();
  if (
    stampedAt instanceof Date &&
    !Number.isFinite(stampedAt.getTime())
  ) {
    throw new RangeError("markSourcesSynced received an invalid timestamp");
  }

  await executor
    .update(sources)
    .set({ lastSyncAt: stampedAt })
    .where(
      ids.length === 1 ? eq(sources.id, ids[0]) : inArray(sources.id, ids),
    );

  return ids;
}

/** Build a sanctioned freshness statement for a Neon HTTP transaction. */
export function markSourcesSyncedTransactionQuery(
  txn: NeonQueryFunctionInTransaction<false, false>,
  sourceIds: string[],
  rowsWritten: number,
  at?: Date,
) {
  const ids = normalizeSourceIds(sourceIds);
  if (
    !Number.isSafeInteger(rowsWritten) ||
    rowsWritten <= 0 ||
    ids.length === 0
  ) {
    throw new RangeError(
      "atomic source freshness requires positive rows and source ids",
    );
  }
  if (at && !Number.isFinite(at.getTime())) {
    throw new RangeError("atomic source freshness requires a valid timestamp");
  }
  return at
    ? txn`UPDATE sources SET last_sync_at = ${at} WHERE id = ANY(${ids})`
    : txn`UPDATE sources SET last_sync_at = NOW() WHERE id = ANY(${ids})`;
}

/**
 * Build the sanctioned freshness CTE for an atomic publish statement. The
 * enclosing statement must expose `inserted_source_rows(source_id)` with only
 * rows inserted by that statement. Empty/duplicate-only work stamps nothing.
 */
export function markSourcesSyncedFromInsertedRowsCte(at: Date): SQL {
  if (!Number.isFinite(at.getTime())) {
    throw new RangeError("atomic source freshness requires a valid timestamp");
  }
  return sql`stamped_sources AS (
    UPDATE sources s
    SET last_sync_at = ${at}
    WHERE EXISTS (
      SELECT 1
      FROM inserted_source_rows inserted
      WHERE inserted.source_id = s.id
    )
    RETURNING s.id
  )`;
}
