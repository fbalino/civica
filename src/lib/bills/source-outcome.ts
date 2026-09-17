import type {
  BillSourceEmptyReason,
  BillSourceFailureCode,
  BillSourceFetchOutcome,
} from "./types";

export const TRANSIENT_BILL_SOURCE_FAILURE_CODES =
  new Set<BillSourceFailureCode>([
    "upstream_timeout",
    "upstream_rate_limited",
    "upstream_unavailable",
    "upstream_network_error",
  ]);

export function failedBillSourceOutcome(
  sourceId: string,
  code: BillSourceFailureCode,
  error: string,
  fetched = 0,
): BillSourceFetchOutcome {
  return { sourceId, status: "failed", fetched, mapped: 0, code, error };
}

export function failedBillSourceHttpOutcome(
  sourceId: string,
  status: number,
): BillSourceFetchOutcome {
  if (status === 408) {
    return failedBillSourceOutcome(
      sourceId,
      "upstream_timeout",
      "publisher request timed out",
    );
  }
  if (status === 429) {
    return failedBillSourceOutcome(
      sourceId,
      "upstream_rate_limited",
      "publisher rate limit reached",
    );
  }
  if ([425, 502, 503, 504].includes(status)) {
    return failedBillSourceOutcome(
      sourceId,
      "upstream_unavailable",
      `publisher temporarily unavailable (HTTP ${status})`,
    );
  }
  if (status === 401 || status === 403) {
    return failedBillSourceOutcome(
      sourceId,
      "source_authentication_failed",
      `publisher authentication failed (HTTP ${status})`,
    );
  }
  if (status === 404) {
    return failedBillSourceOutcome(
      sourceId,
      "source_endpoint_not_found",
      "publisher endpoint was not found (HTTP 404)",
    );
  }
  return failedBillSourceOutcome(
    sourceId,
    "source_http_error",
    `publisher returned HTTP ${status}`,
  );
}

export function failedBillSourceRequestOutcome(
  sourceId: string,
  error: unknown,
): BillSourceFetchOutcome {
  const isTimeout =
    (error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "TimeoutError")) ||
    (error instanceof Error &&
      /\b(?:abort|timed?\s*out|timeout)\b/i.test(error.message));
  return failedBillSourceOutcome(
    sourceId,
    isTimeout ? "upstream_timeout" : "upstream_network_error",
    isTimeout ? "publisher request timed out" : "publisher request failed",
  );
}

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
    requireCompleteMapping?: boolean;
  } = {},
): BillSourceFetchOutcome {
  if (outcome.status === "failed") return outcome;
  if (!Number.isSafeInteger(mapped) || mapped < 0 || mapped > outcome.fetched) {
    return {
      sourceId: outcome.sourceId,
      status: "failed",
      fetched: outcome.fetched,
      mapped: 0,
      code: "source_mapping_failed",
      error: `invalid mapping count ${mapped} for ${outcome.fetched} fetched row(s)`,
    };
  }
  if (options.requireCompleteMapping && mapped !== outcome.fetched) {
    return {
      sourceId: outcome.sourceId,
      status: "failed",
      fetched: outcome.fetched,
      mapped: 0,
      code: "source_mapping_failed",
      error:
        options.zeroMappedError ??
        `${outcome.fetched - mapped} structured row(s) could not be mapped`,
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
    code: "source_mapping_failed",
    error:
      options.zeroMappedError ??
      `${outcome.fetched} structured row(s) produced zero recognized bill drafts`,
  };
}
