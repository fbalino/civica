/**
 * DAT-038 one-time repair of stored bill last-action dates
 * (`bill-last-action-date-repair/v1`).
 *
 * Every stored bill keeps the publisher payload it was built from (`raw`) and
 * the time that payload was written (`updated_at`). The repair re-derives each
 * row's last-action date, and Bundestag DIP's introduction date, from that
 * payload with the corrected adapter functions, using `updated_at` as the
 * retrieval time. Nothing is inferred beyond what the retained payload says,
 * and no other column changes (`updated_at` keeps meaning "when this payload
 * was stored", so a repeat plan stays at zero).
 *
 * Plan writes nothing and records every target's before-state, which is the
 * only record of it: `bills` carries no history trigger, so the plan file is
 * retained with the recovery snapshot and is the compensation input. Apply
 * runs exactly that plan in one transaction: lock `bills`, assert every
 * target is still in its before-state (or already repaired) with its payload
 * unchanged, assert no other bill row changed, update, assert the after-state
 * and the untouched non-targets. Any mismatch rolls everything back. Source
 * freshness is never stamped.
 */
import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";

import {
  BILL_LAST_ACTION_CONTRACT,
  billLastActionErrors,
  type BillLastAction,
  type BillLastActionStatus,
} from "./last-action";
import { usLastAction } from "./sources/us-congress";
import { ukLastAction } from "./sources/uk-parliament";
import { legisinfoLastAction } from "./sources/legisinfo-ca";
import { dipLastAction } from "./sources/bundestag-dip";
import { camaraLastAction, senadoLastAction } from "./sources/camara-senado-br";
import { anLastAction, senatLastAction } from "./sources/an-senat-fr";

export const BILL_DATE_REPAIR_METHOD = "bill-last-action-date-repair/v1";
export const BILL_DATE_REPAIR_PLAN_SCHEMA = "bill-last-action-date-repair-plan/v1";

type Row = Record<string, unknown>;

export interface BillDateRepairExecutor {
  read(statements: SQL[]): Promise<Row[][]>;
  write(statements: SQL[]): Promise<Row[][]>;
}

export class BillDateRepairPlanError extends Error {
  constructor(message: string) {
    super(`Bill date repair plan refused: ${message}`);
    this.name = "BillDateRepairPlanError";
  }
}

interface SourceDerivation {
  lastAction: (raw: unknown, retrievedAt: Date) => BillLastAction;
  /** The derivation reads the payload, so a row without one cannot be re-derived. */
  needsRaw: boolean;
  /** DIP's list has no introduction date; its former value was `datum`. */
  clearsIntroducedDate: boolean;
}

/** One entry per `bills.source_id` written by a deployed adapter. */
export const BILL_LAST_ACTION_DERIVATIONS: Readonly<
  Record<string, SourceDerivation>
> = {
  congress_gov: { lastAction: usLastAction, needsRaw: true, clearsIntroducedDate: false },
  uk_parliament: { lastAction: ukLastAction, needsRaw: true, clearsIntroducedDate: false },
  legisinfo_ca: { lastAction: legisinfoLastAction, needsRaw: true, clearsIntroducedDate: false },
  bundestag_dip: { lastAction: dipLastAction, needsRaw: true, clearsIntroducedDate: true },
  camara_br: { lastAction: () => camaraLastAction(), needsRaw: false, clearsIntroducedDate: false },
  senado_br: { lastAction: () => senadoLastAction(), needsRaw: false, clearsIntroducedDate: false },
  data_assemblee_fr: { lastAction: anLastAction, needsRaw: true, clearsIntroducedDate: false },
  senat_fr: { lastAction: senatLastAction, needsRaw: true, clearsIntroducedDate: false },
};

export interface BillDateState {
  lastActionDate: string | null;
  lastActionDateStatus: string;
  lastActionDateReason: string | null;
  introducedDate: string | null;
}

export interface StoredBillDateRow extends BillDateState {
  id: string;
  sourceId: string;
  raw: unknown;
  rawMd5: string | null;
  /** `updated_at::text`: when the stored payload was written (UTC). */
  updatedAt: string;
  createdAt: string;
  /** SQL row digest (see ROW_DIGEST_SQL). */
  digest: string;
}

export type BillDateRepairCategory =
  | "date_cleared"
  | "date_replaced"
  | "absence_relabelled"
  | "introduced_cleared";

export interface BillDateRepairTarget {
  id: string;
  sourceId: string;
  categories: BillDateRepairCategory[];
  before: BillDateState;
  after: BillDateState;
  /** The payload and write time the after-state was derived from. */
  guard: { rawMd5: string | null; updatedAt: string };
  /** The former stored date equalled the row's own write or creation day. */
  beforeDateWasWriteDay: boolean;
}

export interface BillDateSourceSummary {
  rows: number;
  unchanged: number;
  targets: number;
  dateCleared: number;
  dateReplaced: number;
  absenceRelabelled: number;
  introducedCleared: number;
  /** Rows whose stored date equals their write/creation day, before repair. */
  storedDateWasWriteDay: number;
  /** Of those, how many the retained payload actually dates to that day. */
  writeDayConfirmedByPayload: number;
  after: Record<BillLastActionStatus, number>;
}

export interface BillDateRepairPlan {
  schemaVersion: typeof BILL_DATE_REPAIR_PLAN_SCHEMA;
  methodologyVersion: typeof BILL_DATE_REPAIR_METHOD;
  contract: typeof BILL_LAST_ACTION_CONTRACT;
  rowsRead: number;
  bySource: Record<string, BillDateSourceSummary>;
  totals: {
    targets: number;
    dateCleared: number;
    dateReplaced: number;
    absenceRelabelled: number;
    introducedCleared: number;
  };
  /** SHA-256 over every non-target bill row's SQL digest. */
  nonTargetFingerprint: string;
  /** `sources.last_sync_at::text` for every bill source at plan time. */
  sourceFreshness: Record<string, string | null>;
  targets: BillDateRepairTarget[];
  planSha256: string;
}

// ─── Load ────────────────────────────────────────────────────────────────────

/** Null-safe per-row digest. Changing it changes every plan's fingerprint. */
const ROW_DIGEST_SQL = sql.raw(`md5(concat_ws('|',
  b.source_id,
  b.external_id,
  coalesce(b.last_action_date::text, '\\N'),
  b.last_action_date_status,
  coalesce(b.last_action_date_reason, '\\N'),
  coalesce(b.introduced_date::text, '\\N'),
  b.updated_at::text,
  coalesce(md5(b.raw::text), '\\N')
))`);

/**
 * One page of bills by id. Payloads (`raw`) can be large (Assemblée dossiers
 * carry their whole act tree), so the plan never asks Neon's HTTP endpoint for
 * every payload in one response. Pages may come from different snapshots;
 * apply re-checks every row's digest under a table lock, so a write between
 * pages aborts the apply instead of slipping through.
 */
const loadBillsPage = (after: string, limit: number) => sql`SELECT
    b.id::text AS id,
    b.source_id,
    b.last_action_date::text AS last_action_date,
    b.last_action_date_status,
    b.last_action_date_reason,
    b.introduced_date::text AS introduced_date,
    b.raw,
    md5(b.raw::text) AS raw_md5,
    b.updated_at::text AS updated_at,
    b.created_at::text AS created_at,
    ${ROW_DIGEST_SQL} AS digest
  FROM bills b
  WHERE b.id::text COLLATE "C" > ${after}
  ORDER BY b.id::text COLLATE "C"
  LIMIT ${limit}`;

/** Rows per read; keeps each Neon HTTP response well under its size limit. */
export const BILL_DATE_REPAIR_PAGE_SIZE = 100;

const LOAD_FRESHNESS = sql`SELECT s.id, s.last_sync_at::text AS last_sync_at
  FROM sources s
  WHERE s.id IN (SELECT DISTINCT source_id FROM bills)
  ORDER BY s.id COLLATE "C"`;

function text(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export async function loadBillDateRepairState(
  executor: BillDateRepairExecutor,
  pageSize: number = BILL_DATE_REPAIR_PAGE_SIZE,
) {
  const [freshness] = await executor.read([LOAD_FRESHNESS]);
  const bills: Row[] = [];
  for (let after = ""; ; ) {
    const [page] = await executor.read([loadBillsPage(after, pageSize)]);
    bills.push(...page);
    if (page.length < pageSize) break;
    after = String(page[page.length - 1].id);
  }
  const rows: StoredBillDateRow[] = bills.map((row) => ({
    id: String(row.id),
    sourceId: String(row.source_id),
    lastActionDate: text(row.last_action_date),
    lastActionDateStatus: String(row.last_action_date_status),
    lastActionDateReason: text(row.last_action_date_reason),
    introducedDate: text(row.introduced_date),
    raw: typeof row.raw === "string" ? JSON.parse(row.raw) : row.raw,
    rawMd5: text(row.raw_md5),
    updatedAt: String(row.updated_at),
    createdAt: String(row.created_at),
    digest: String(row.digest),
  }));
  const sourceFreshness = Object.fromEntries(
    freshness.map((row) => [String(row.id), text(row.last_sync_at)]),
  );
  return { rows, sourceFreshness };
}

// ─── Plan ────────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** A `timestamp without time zone` text value, read as UTC. */
function utcTimestamp(value: string): Date {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  if (!Number.isFinite(date.getTime())) {
    throw new BillDateRepairPlanError(`unreadable updated_at ${value}`);
  }
  return date;
}

function sameState(a: BillDateState, b: BillDateState): boolean {
  return (
    a.lastActionDate === b.lastActionDate &&
    a.lastActionDateStatus === b.lastActionDateStatus &&
    a.lastActionDateReason === b.lastActionDateReason &&
    a.introducedDate === b.introducedDate
  );
}

function emptySummary(): BillDateSourceSummary {
  return {
    rows: 0,
    unchanged: 0,
    targets: 0,
    dateCleared: 0,
    dateReplaced: 0,
    absenceRelabelled: 0,
    introducedCleared: 0,
    storedDateWasWriteDay: 0,
    writeDayConfirmedByPayload: 0,
    after: { observed: 0, missing: 0, not_observed: 0 },
  };
}

/** SHA-256 over sorted `id:digest` lines, matching NON_TARGET_FINGERPRINT_SQL. */
export function fingerprintRows(rows: ReadonlyArray<{ id: string; digest: string }>) {
  return sha256(
    [...rows]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((row) => `${row.id}:${row.digest}`)
      .join("\n"),
  );
}

export function planBillDateRepair(state: {
  rows: StoredBillDateRow[];
  sourceFreshness: Record<string, string | null>;
}): BillDateRepairPlan {
  const bySource: Record<string, BillDateSourceSummary> = {};
  const targets: BillDateRepairTarget[] = [];
  const nonTargets: StoredBillDateRow[] = [];

  for (const row of state.rows) {
    const derivation = BILL_LAST_ACTION_DERIVATIONS[row.sourceId];
    if (!derivation) {
      throw new BillDateRepairPlanError(
        `no registered derivation for source ${row.sourceId} (bill ${row.id})`,
      );
    }
    if (derivation.needsRaw && (row.raw === null || row.raw === undefined)) {
      throw new BillDateRepairPlanError(
        `bill ${row.id} (${row.sourceId}) has no retained payload to re-derive from`,
      );
    }
    const retrievedAt = utcTimestamp(row.updatedAt);
    const action = derivation.lastAction(row.raw, retrievedAt);
    const after: BillDateState = {
      lastActionDate: action.date,
      lastActionDateStatus: action.status,
      lastActionDateReason: action.reason,
      introducedDate: derivation.clearsIntroducedDate ? null : row.introducedDate,
    };
    const errors = billLastActionErrors(after);
    if (errors.length) {
      throw new BillDateRepairPlanError(
        `bill ${row.id} derived an invalid state: ${errors.join("; ")}`,
      );
    }
    const before: BillDateState = {
      lastActionDate: row.lastActionDate,
      lastActionDateStatus: row.lastActionDateStatus,
      lastActionDateReason: row.lastActionDateReason,
      introducedDate: row.introducedDate,
    };

    const summary = (bySource[row.sourceId] ??= emptySummary());
    summary.rows++;
    summary.after[action.status]++;
    const writeDays = new Set([row.updatedAt.slice(0, 10), row.createdAt.slice(0, 10)]);
    const wasWriteDay =
      before.lastActionDate !== null && writeDays.has(before.lastActionDate);
    if (wasWriteDay) {
      summary.storedDateWasWriteDay++;
      if (after.lastActionDate === before.lastActionDate) {
        summary.writeDayConfirmedByPayload++;
      }
    }

    if (sameState(before, after)) {
      summary.unchanged++;
      nonTargets.push(row);
      continue;
    }

    const categories: BillDateRepairCategory[] = [];
    if (before.lastActionDate !== after.lastActionDate) {
      if (after.lastActionDate === null) {
        categories.push("date_cleared");
        summary.dateCleared++;
      } else {
        categories.push("date_replaced");
        summary.dateReplaced++;
      }
    } else if (
      before.lastActionDateStatus !== after.lastActionDateStatus ||
      before.lastActionDateReason !== after.lastActionDateReason
    ) {
      categories.push("absence_relabelled");
      summary.absenceRelabelled++;
    }
    if (before.introducedDate !== after.introducedDate) {
      categories.push("introduced_cleared");
      summary.introducedCleared++;
    }
    summary.targets++;
    targets.push({
      id: row.id,
      sourceId: row.sourceId,
      categories,
      before,
      after,
      guard: { rawMd5: row.rawMd5, updatedAt: row.updatedAt },
      beforeDateWasWriteDay: wasWriteDay,
    });
  }

  const sumOf = (key: keyof Omit<BillDateSourceSummary, "after">) =>
    Object.values(bySource).reduce((total, summary) => total + summary[key], 0);
  const body: Omit<BillDateRepairPlan, "planSha256"> = {
    schemaVersion: BILL_DATE_REPAIR_PLAN_SCHEMA,
    methodologyVersion: BILL_DATE_REPAIR_METHOD,
    contract: BILL_LAST_ACTION_CONTRACT,
    rowsRead: state.rows.length,
    bySource: Object.fromEntries(
      Object.entries(bySource).sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
    totals: {
      targets: targets.length,
      dateCleared: sumOf("dateCleared"),
      dateReplaced: sumOf("dateReplaced"),
      absenceRelabelled: sumOf("absenceRelabelled"),
      introducedCleared: sumOf("introducedCleared"),
    },
    nonTargetFingerprint: fingerprintRows(nonTargets),
    sourceFreshness: state.sourceFreshness,
    targets,
  };
  return { ...body, planSha256: sha256(JSON.stringify(body)) };
}

export function verifyBillDatePlanDigest(plan: BillDateRepairPlan): boolean {
  const { planSha256, ...body } = plan;
  return sha256(JSON.stringify(body)) === planSha256;
}

// ─── Apply ───────────────────────────────────────────────────────────────────

function assertion(marker: string, countSql: SQL): SQL {
  return sql`SELECT CASE WHEN x.problems = 0 THEN 1
      ELSE (${`civica_assertion_failed:${marker}:`} || x.problems::text)::integer
    END AS verified
    FROM (${countSql}) x`;
}

function targetRecords(plan: BillDateRepairPlan) {
  return JSON.stringify(
    plan.targets.map((target) => ({
      id: target.id,
      before_date: target.before.lastActionDate,
      before_status: target.before.lastActionDateStatus,
      before_reason: target.before.lastActionDateReason,
      before_introduced: target.before.introducedDate,
      after_date: target.after.lastActionDate,
      after_status: target.after.lastActionDateStatus,
      after_reason: target.after.lastActionDateReason,
      after_introduced: target.after.introducedDate,
      raw_md5: target.guard.rawMd5,
      updated_at: target.guard.updatedAt,
    })),
  );
}

const RECORDSET_COLUMNS = sql.raw(`e(
  id uuid,
  before_date date, before_status text, before_reason text, before_introduced date,
  after_date date, after_status text, after_reason text, after_introduced date,
  raw_md5 text, updated_at text
)`);

const IS_BEFORE = sql.raw(`(b.last_action_date IS NOT DISTINCT FROM e.before_date
  AND b.last_action_date_status = e.before_status
  AND b.last_action_date_reason IS NOT DISTINCT FROM e.before_reason
  AND b.introduced_date IS NOT DISTINCT FROM e.before_introduced)`);

const IS_AFTER = sql.raw(`(b.last_action_date IS NOT DISTINCT FROM e.after_date
  AND b.last_action_date_status = e.after_status
  AND b.last_action_date_reason IS NOT DISTINCT FROM e.after_reason
  AND b.introduced_date IS NOT DISTINCT FROM e.after_introduced)`);

const GUARD_HOLDS = sql.raw(`(md5(b.raw::text) IS NOT DISTINCT FROM e.raw_md5
  AND b.updated_at::text = e.updated_at)`);

/** Apply sends the targets once and reads them from this temp table. */
const STAGED_TARGETS = sql.raw("bill_date_repair_targets");

function inlineTargets(plan: BillDateRepairPlan): SQL {
  return sql`jsonb_to_recordset(${targetRecords(plan)}::jsonb) AS ${RECORDSET_COLUMNS}`;
}

function targetProblems(targets: SQL, acceptBefore: boolean): SQL {
  return sql`SELECT count(*)::int AS problems
    FROM ${targets}
    LEFT JOIN bills b ON b.id = e.id
    WHERE b.id IS NULL
      OR NOT ${GUARD_HOLDS}
      OR NOT (${IS_AFTER} OR (${sql.raw(acceptBefore ? "true" : "false")} AND ${IS_BEFORE}))`;
}

function nonTargetFingerprintSql(): SQL {
  return sql`SELECT encode(sha256(convert_to(coalesce(
      string_agg(b.id::text || ':' || ${ROW_DIGEST_SQL}, E'\\n' ORDER BY b.id::text COLLATE "C"), ''),
      'UTF8')), 'hex') AS fingerprint
    FROM bills b
    WHERE NOT EXISTS (SELECT 1 FROM ${STAGED_TARGETS} t WHERE t.id = b.id)`;
}

function nonTargetAssertion(plan: BillDateRepairPlan, stage: "before" | "after"): SQL {
  return assertion(
    `bill_date_repair_non_target_drift_${stage}`,
    sql`SELECT ((${nonTargetFingerprintSql()}) <> ${plan.nonTargetFingerprint})::int AS problems`,
  );
}

export interface BillDateRepairApplyResult {
  planSha256: string;
  rowsUpdated: number;
  targetsAlreadyRepaired: number;
  transactionStartedAt: string;
}

export async function applyBillDateRepair(
  executor: BillDateRepairExecutor,
  plan: BillDateRepairPlan,
): Promise<BillDateRepairApplyResult> {
  if (!verifyBillDatePlanDigest(plan)) {
    throw new BillDateRepairPlanError("the plan's contents do not match its SHA-256");
  }
  const staged = sql`${STAGED_TARGETS} e`;
  const results = await executor.write([
    sql`LOCK TABLE bills IN SHARE ROW EXCLUSIVE MODE`,
    sql`CREATE TEMP TABLE ${STAGED_TARGETS} ON COMMIT DROP AS
      SELECT * FROM ${inlineTargets(plan)}`,
    assertion("bill_date_repair_drift", targetProblems(staged, true)),
    nonTargetAssertion(plan, "before"),
    sql`UPDATE bills b SET
        last_action_date = e.after_date,
        last_action_date_status = e.after_status,
        last_action_date_reason = e.after_reason,
        introduced_date = e.after_introduced
      FROM ${staged}
      WHERE b.id = e.id AND ${IS_BEFORE} AND ${GUARD_HOLDS}
      RETURNING b.id`,
    assertion("bill_date_repair_postcondition", targetProblems(staged, false)),
    nonTargetAssertion(plan, "after"),
    sql`SELECT now()::text AS transaction_started_at`,
  ]);
  const rowsUpdated = results[4]?.length ?? 0;
  return {
    planSha256: plan.planSha256,
    rowsUpdated,
    targetsAlreadyRepaired: plan.targets.length - rowsUpdated,
    transactionStartedAt: String(results[7]?.[0]?.transaction_started_at ?? ""),
  };
}

// ─── Verify ──────────────────────────────────────────────────────────────────

export interface BillDateRepairVerification {
  pass: boolean;
  checks: Record<string, { pass: boolean; detail: string }>;
  statusBySource: Record<string, Record<string, number>>;
}

/**
 * Read-only postflight.
 * V1 every row satisfies the typed-date contract (mirrors the CHECKs, which
 *    a NULL result would otherwise let through).
 * V2 no observed date falls after its payload's write day plus one.
 * V3 a new plan proposes nothing: every stored date equals its re-derivation.
 * V4 every target of the applied plan is in its after-state.
 * V5 bill source freshness is unchanged since the plan.
 */
export async function verifyBillDateRepair(
  executor: BillDateRepairExecutor,
  options: { plan?: BillDateRepairPlan } = {},
): Promise<BillDateRepairVerification> {
  const statements: SQL[] = [
    sql`SELECT count(*)::int AS problems FROM bills b
      WHERE b.last_action_date_status NOT IN ('observed', 'missing', 'not_observed')
         OR (b.last_action_date_status = 'observed') <> (b.last_action_date IS NOT NULL)
         OR (b.last_action_date_status = 'observed') <> (b.last_action_date_reason IS NULL)
         OR (b.last_action_date_reason IS NOT NULL AND length(btrim(b.last_action_date_reason)) = 0)`,
    sql`SELECT count(*)::int AS problems FROM bills b
      WHERE b.last_action_date > (b.updated_at::date + 1)`,
    sql`SELECT b.source_id, b.last_action_date_status AS status, count(*)::int AS n
      FROM bills b GROUP BY 1, 2 ORDER BY 1, 2`,
  ];
  if (options.plan) statements.push(targetProblems(inlineTargets(options.plan), false));
  const results = await executor.read(statements);
  const contractProblems = Number(results[0]?.[0]?.problems ?? -1);
  const futureProblems = Number(results[1]?.[0]?.problems ?? -1);
  const statusBySource: Record<string, Record<string, number>> = {};
  for (const row of results[2] ?? []) {
    (statusBySource[String(row.source_id)] ??= {})[String(row.status)] = Number(row.n);
  }

  const state = await loadBillDateRepairState(executor);
  const replan = planBillDateRepair(state);
  const checks: BillDateRepairVerification["checks"] = {
    V1_contract: {
      pass: contractProblems === 0,
      detail: `${contractProblems} row(s) violate bill-last-action-date/v1`,
    },
    V2_no_future_dates: {
      pass: futureProblems === 0,
      detail: `${futureProblems} observed date(s) after the payload write day + 1`,
    },
    V3_zero_replan: {
      pass: replan.targets.length === 0,
      detail: `a new plan proposes ${replan.targets.length} change(s)`,
    },
  };
  if (options.plan) {
    const pending = Number(results[3]?.[0]?.problems ?? -1);
    checks.V4_plan_applied = {
      pass: pending === 0,
      detail: `${pending} planned target(s) not in their after-state`,
    };
    const changed = Object.entries(options.plan.sourceFreshness).filter(
      ([id, value]) => state.sourceFreshness[id] !== value,
    );
    checks.V5_freshness_unchanged = {
      pass: changed.length === 0,
      detail: changed.length
        ? `source freshness moved for ${changed.map(([id]) => id).join(", ")} (a sync ran after the plan)`
        : "no bill source's last_sync_at changed since the plan",
    };
  }
  return {
    pass: Object.values(checks).every((check) => check.pass),
    checks,
    statusBySource,
  };
}
