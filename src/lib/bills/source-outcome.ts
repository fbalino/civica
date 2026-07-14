import type { BillSourceEmptyReason, BillSourceFetchOutcome } from "./types";

/**
 * Close the gap between a syntactically successful fetch and usable bill
 * drafts. Non-empty publisher data that maps to nothing is a failure unless
 * the adapter names a narrow, auditable quiet-period reason.
 */
export function finalizeBillSourceMapping(
  outcome: BillSourceFetchOutcome,
  mapped: number,
  options: {
    benignEmptyReason?: BillSourceEmptyReason;
    zeroMappedError?: string;
  } = {},
): BillSourceFetchOutcome {
  if (outcome.status === "failed") return outcome;
  if (!Number.isSafeInteger(mapped) || mapped < 0 || mapped > outcome.fetched) {
    return {
      sourceId: outcome.sourceId,
      status: "failed",
      fetched: outcome.fetched,
      mapped: 0,
      error: `invalid mapping count ${mapped} for ${outcome.fetched} fetched row(s)`,
    };
  }
  if (mapped > 0) {
    return { ...outcome, mapped, emptyReason: undefined };
  }
  if (outcome.fetched === 0) {
    return {
      ...outcome,
      mapped: 0,
      emptyReason: "upstream_returned_no_rows",
    };
  }
  if (options.benignEmptyReason) {
    return {
      ...outcome,
      mapped: 0,
      emptyReason: options.benignEmptyReason,
    };
  }
  return {
    sourceId: outcome.sourceId,
    status: "failed",
    fetched: outcome.fetched,
    mapped: 0,
    error:
      options.zeroMappedError ??
      `${outcome.fetched} structured row(s) produced zero recognized bill drafts`,
  };
}
