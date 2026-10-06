/**
 * DAT-038 — `bill-last-action-date/v1`.
 *
 * A bill's "last action" date is a date the publisher gives to a legislative
 * step: a recorded action, a sitting, a dated act or document, a decision, or
 * a promulgation. It is never the time Civica retrieved the record, and never
 * a date the publisher's system last modified the record (Congress.gov
 * `updateDate`, UK Bills API `lastUpdate`, Bundestag DIP `aktualisiert`,
 * Senado `DataUltimaAtualizacao`).
 *
 * When the feed Civica reads carries no such date, the row stores no date and
 * a typed `data-value-state/v1` absence with a reason:
 *
 * - `missing`: the publisher dates this step elsewhere, but the feed Civica
 *   reads does not carry it (a pipeline gap, e.g. Câmara's list endpoint).
 * - `not_observed`: the publisher record Civica holds has no dated step on or
 *   before retrieval (e.g. a UK bill whose current stage has no sitting yet).
 *
 * The pure per-source derivations live in the adapters and are reused by the
 * stored-data repair, which re-derives each row from its retained `raw`
 * payload. Field meanings are recorded in `plan/evidence/DAT-038/README.md`.
 */
import {
  validateDataValueState,
  type DataValueStatus,
} from "@/lib/data/value-state";

export const BILL_LAST_ACTION_CONTRACT = "bill-last-action-date/v1";

export const BILL_LAST_ACTION_STATUSES = [
  "observed",
  "missing",
  "not_observed",
] as const satisfies readonly DataValueStatus[];

export type BillLastActionStatus = (typeof BILL_LAST_ACTION_STATUSES)[number];

export type BillLastAction =
  | { status: "observed"; date: string; reason: null }
  | { status: "missing" | "not_observed"; date: null; reason: string };

/** Registered absence reasons, one per source condition. */
export const BILL_LAST_ACTION_REASONS = {
  camaraListFeed:
    "The Câmara dos Deputados proposições list feed carries no action date; Civica does not yet read the per-bill statusProposicao.dataHora field.",
  senadoUpdatedFeed:
    "The Senado Federal updated-matters feed reports only record-update times (DataUltimaAtualizacao), not legislative action dates.",
  dipNoDocument:
    "Bundestag DIP reports no dated document for this proceeding on or before retrieval.",
  ukNoSitting:
    "The UK Bills API record's current stage has no sitting dated on or before retrieval.",
  usNoLatestAction:
    "The Congress.gov record carries no latestAction.actionDate.",
  anNoAct:
    "The Assemblée nationale dossier records no dated legislative act on or before retrieval.",
  senatNoLaterStep:
    "The Sénat dossier export dates only deposit, Constitutional Council decision, and promulgation; this dossier has no dated decision or promulgation.",
  legisinfoNoEvent:
    "The LEGISinfo record carries no dated bill event on or before retrieval.",
} as const;

export function observedLastAction(date: string): BillLastAction {
  return { status: "observed", date, reason: null };
}

export function absentLastAction(
  status: "missing" | "not_observed",
  reason: string,
): BillLastAction {
  return { status, date: null, reason };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * The publisher-local calendar date of a publisher date or date-time value,
 * or null when it is not a real date or falls after the retrieval day.
 *
 * The date part is taken as written (publisher-local), never converted to
 * UTC. A publisher east of UTC can be one calendar day ahead of the UTC
 * retrieval date, so one day of tolerance is allowed; anything later is a
 * scheduled or erroneous date, not a past action.
 */
export function publisherActionDate(
  value: string | null | undefined,
  retrievedAt: Date,
): string | null {
  if (typeof value !== "string") return null;
  const date = value.trim().slice(0, 10);
  if (!isCalendarDate(date)) return null;
  if (!Number.isFinite(retrievedAt.getTime())) {
    throw new RangeError("retrievedAt must be a valid date");
  }
  const latest = new Date(retrievedAt.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return date <= latest ? date : null;
}

/** The latest of several publisher action dates, applying the same rules. */
export function latestPublisherActionDate(
  values: ReadonlyArray<string | null | undefined>,
  retrievedAt: Date,
): string | null {
  return (
    values
      .map((value) => publisherActionDate(value, retrievedAt))
      .filter((date): date is string => date !== null)
      .sort()
      .at(-1) ?? null
  );
}

/** Contract errors for a stored or ingested last-action triple. */
export function billLastActionErrors(input: {
  lastActionDate: string | null;
  lastActionDateStatus: string;
  lastActionDateReason: string | null;
}): string[] {
  const status = input.lastActionDateStatus;
  if (!(BILL_LAST_ACTION_STATUSES as readonly string[]).includes(status)) {
    return [`lastActionDateStatus must be one of ${BILL_LAST_ACTION_STATUSES.join(", ")}`];
  }
  const errors = validateDataValueState({
    status: status as BillLastActionStatus,
    hasValue: input.lastActionDate !== null,
    reason: input.lastActionDateReason,
  }).map((error) => `lastActionDate: ${error}`);
  if (input.lastActionDate !== null && !isCalendarDate(input.lastActionDate)) {
    errors.push("lastActionDate must be a real YYYY-MM-DD calendar date");
  }
  return errors;
}

/** Flatten a derived last action into the ingest/storage fields. */
export function lastActionFields(action: BillLastAction): {
  lastActionDate: string | null;
  lastActionDateStatus: BillLastActionStatus;
  lastActionDateReason: string | null;
} {
  return {
    lastActionDate: action.date,
    lastActionDateStatus: action.status,
    lastActionDateReason: action.reason,
  };
}
