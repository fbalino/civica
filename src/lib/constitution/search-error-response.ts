import {
  CONSTITUTION_SEARCH_SCHEMA_VERSION,
  type ConstitutionSearchErrorCode,
  type ConstitutionSearchErrorResponse,
  type ConstitutionSearchProblemCode,
} from "./search-contract";

type SearchErrorStatus = 400 | 409 | 422 | 429 | 503 | 504;

interface SearchErrorProfile {
  code: ConstitutionSearchProblemCode;
  message: string;
  status: SearchErrorStatus;
}

const SEARCH_ERROR_PROFILES = Object.freeze({
  invalid_request: {
    code: "INVALID_REQUEST",
    message: "The constitution search request is invalid.",
    status: 400,
  },
  query_not_searchable: {
    code: "QUERY_NOT_SEARCHABLE",
    message: "The query contains no searchable English terms.",
    status: 400,
  },
  jurisdiction_not_covered: {
    code: "JURISDICTION_NOT_COVERED",
    message: "One or more requested jurisdictions are not indexed.",
    status: 422,
  },
  cursor_stale: {
    code: "CURSOR_STALE",
    message: "The search cursor is no longer valid for this query.",
    status: 409,
  },
  rate_limited: {
    code: "RATE_LIMITED",
    message: "Rate limit exceeded. Try again shortly.",
    status: 429,
  },
  rights_not_ready: {
    code: "RIGHTS_NOT_READY",
    message:
      "Constitution search is unavailable under the current rights policy.",
    status: 503,
  },
  data_unavailable: {
    code: "DATA_UNAVAILABLE",
    message: "The constitution search index is temporarily unavailable.",
    status: 503,
  },
  query_timeout: {
    code: "QUERY_TIMEOUT",
    message: "The constitution search timed out.",
    status: 504,
  },
} as const satisfies Record<ConstitutionSearchErrorCode, SearchErrorProfile>);

function safeUncoveredJurisdictions(
  details: ConstitutionSearchErrorResponse["details"] | undefined,
): ConstitutionSearchErrorResponse["details"] | undefined {
  const values = details?.uncoveredJurisdictions;
  if (!values) return undefined;
  const uncoveredJurisdictions = values
    .filter((value) => /^[a-z0-9-]{1,100}$/.test(value))
    .slice(0, 20);
  return uncoveredJurisdictions.length > 0
    ? { uncoveredJurisdictions }
    : undefined;
}

/**
 * Convert lower-layer search failures to a closed public contract. Exception
 * messages, statuses, rights-provider detail, and future detail fields never
 * cross this boundary.
 */
export function shapeConstitutionSearchError(
  error: ConstitutionSearchErrorCode,
  details?: ConstitutionSearchErrorResponse["details"],
): {
  body: ConstitutionSearchErrorResponse;
  status: SearchErrorStatus;
} {
  const profile = SEARCH_ERROR_PROFILES[error];
  const safeDetails =
    error === "jurisdiction_not_covered"
      ? safeUncoveredJurisdictions(details)
      : undefined;
  return {
    status: profile.status,
    body: {
      schemaVersion: CONSTITUTION_SEARCH_SCHEMA_VERSION,
      error,
      code: profile.code,
      message: profile.message,
      ...(safeDetails ? { details: safeDetails } : {}),
    },
  };
}
