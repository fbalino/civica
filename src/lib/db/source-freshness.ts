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
 */
import { eq, inArray } from "drizzle-orm";

import { db } from "./index";
import { sources } from "./schema";

/**
 * Anything that can run an `UPDATE sources` — the shared `db` client or
 * a transaction handle from `db.transaction(...)`. Defaulting to `db`
 * lets transaction callers pass their `tx` while everyone else omits it.
 */
export type SourceFreshnessExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

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
   * Timestamp to stamp. Defaults to `new Date()` (i.e. NOW()). Pass an
   * explicit value to align the stamp with a run's `retrievedAt`.
   */
  at?: Date;
  /**
   * Executor to run the UPDATE against. Defaults to the shared `db`
   * client, so transaction callers can pass their `tx` and everyone
   * else can omit it.
   */
  executor?: SourceFreshnessExecutor;
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
  const { rowsWritten, dryRun = false, at, executor = db } = opts;

  // A dry run or an empty/failed sync must never advance freshness.
  if (dryRun || !Number.isSafeInteger(rowsWritten) || rowsWritten <= 0) {
    return [];
  }

  const ids = Array.from(
    new Set(
      (Array.isArray(sourceIds) ? sourceIds : [sourceIds])
        .map((id) => id.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (ids.length === 0) return [];

  const stampedAt = at ?? new Date();
  if (!Number.isFinite(stampedAt.getTime())) {
    throw new RangeError("markSourcesSynced received an invalid timestamp");
  }

  await executor
    .update(sources)
    .set({ lastSyncAt: stampedAt })
    .where(ids.length === 1 ? eq(sources.id, ids[0]) : inArray(sources.id, ids));

  return ids;
}
