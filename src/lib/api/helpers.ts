import { NextResponse } from "next/server";
import { civicaIndex } from "@/lib/content/site-state";
import { CURRENT_PULSE_RUNTIME_METHOD } from "@/lib/pulse/v2/runtime-contract";
import { CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY } from "@/lib/pulse/v2/public-numeric-policy";
import {
  V1_RATE_LIMIT_MAX,
  V1_RATE_LIMIT_WINDOW_MS,
} from "@/lib/api/contract/rate-limits";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { CURRENT_CI_UNCERTAINTY_POLICY } from "@/lib/ci/uncertainty-policy";
import { CURRENT_CI_RANK_POLICY } from "@/lib/ci/rank-policy";
import { cacheControlFor } from "@/lib/platform/cache-consistency";

// CLM-012: exported so contract/registry.ts documents the real header
// values instead of retyping them.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

/**
 * Methodology status metadata for CI + Pulse API endpoints.
 *
 * The Civica Index is in active methodology development. Published scores
 * carry a "Beta" status flag. Citations follow the year-quarter convention
 * (e.g. "Civica Index 2026 Q3 (Beta)") — there is no public version number.
 *
 * Endpoints that surface CI or Pulse data include this object as
 * `meta.methodology` in their response envelope so machine consumers
 * can detect the development phase and presentation contract.
 *
 * Drives off `state.civicaIndex.{status,lastRevisionIso}`
 * so a single state-file edit propagates to every API endpoint.
 */
export const CI_METHODOLOGY_META = Object.freeze({
  scope: "current_runtime_interpretation" as const,
  status: civicaIndex.status,
  standing: "secondary_research_experiment" as const,
  independent_validation: false as const,
  atlas_dependency: false as const,
  last_revised: civicaIndex.lastRevisionIso,
  reference: "https://civicaatlas.org/civica-index/methodology",
  missingness: Object.freeze({
    policy_id: civicaIndex.missingness.id,
    mandatory_dimensions: civicaIndex.missingness.mandatoryDimensions,
    optional_dimensions: civicaIndex.missingness.optionalDimensions,
    minimum_dimensions_for_publication:
      civicaIndex.missingness.minimumDimensionsForPublication,
    maximum_missing_optional_dimensions:
      civicaIndex.missingness.maximumMissingOptionalDimensions,
    partial_weight_treatment: civicaIndex.missingness.partialWeightTreatment,
    partial_range_multiplier: civicaIndex.missingness.partialRangeMultiplier,
    partial_comparability: civicaIndex.missingness.partialComparability,
    insufficient_treatment: civicaIndex.missingness.insufficientTreatment,
  }),
  uncertainty: Object.freeze({
    policy_id: CURRENT_CI_UNCERTAINTY_POLICY.id,
    point_estimate: CURRENT_CI_UNCERTAINTY_POLICY.pointEstimate,
    displayed_range: CURRENT_CI_UNCERTAINTY_POLICY.displayedRange,
    covariance_model: CURRENT_CI_UNCERTAINTY_POLICY.covarianceModel,
    usable_released_uncertainty_rows:
      CURRENT_CI_UNCERTAINTY_POLICY.usableReleasedUncertaintyRows,
    released_dimension_rows:
      CURRENT_CI_UNCERTAINTY_POLICY.releasedDimensionRows,
    disposition: CURRENT_CI_UNCERTAINTY_POLICY.disposition,
  }),
  ranking: Object.freeze({
    policy_id: CURRENT_CI_RANK_POLICY.id,
    ranked_quantity: CURRENT_CI_RANK_POLICY.rankedQuantity,
    tie_method: CURRENT_CI_RANK_POLICY.tieMethod,
    tie_breaker: CURRENT_CI_RANK_POLICY.tieBreaker,
    display_order_within_tie: CURRENT_CI_RANK_POLICY.displayOrderWithinTie,
    rank_uncertainty: CURRENT_CI_RANK_POLICY.rankUncertainty,
  }),
  presentation: Object.freeze({
    format: "numeric_position",
    scale: Object.freeze({ min: 0, max: 100 }),
    input_variation_range: "not_published",
    categorical_grades: false,
  }),
});

/** Pulse-specific machine contract. Never reuse CI's 0–100 presentation
 * metadata for event-ledger or dimensional-delta responses. */
export const PULSE_METHODOLOGY_META = Object.freeze({
  status: CURRENT_PULSE_RUNTIME_METHOD.status,
  version: CURRENT_PULSE_RUNTIME_METHOD.version,
  taxonomy_version: CURRENT_PULSE_RUNTIME_METHOD.taxonomy.version,
  reference: "https://civicaatlas.org/civica-index/methodology/pulse",
  runtime_snapshot: "/api/v1/pulse/methodology",
  method_version_coverage: CURRENT_PULSE_RUNTIME_METHOD.mixed_legacy_unversioned
    ? "mixed_legacy_unversioned"
    : "explicit_row_level_versions",
  presentation: Object.freeze({
    format: CURRENT_PULSE_RUNTIME_METHOD.numericDeltas.shape,
    public_status: CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.publicStatus,
    scalar_pulse_score: false,
    trailing_window_days:
      CURRENT_PULSE_RUNTIME_METHOD.numericDeltas.trailingWindowDays,
    bounds_per_dimension: Object.freeze({
      ...CURRENT_PULSE_RUNTIME_METHOD.numericDeltas.boundsPerDimension,
    }),
  }),
  evaluation: Object.freeze({
    current_production_backtest_complete:
      CURRENT_PULSE_RUNTIME_METHOD.evaluation
        .currentProductionValidatedByExistingBacktest,
    independent_validation:
      CURRENT_PULSE_RUNTIME_METHOD.evaluation.externalValidation,
  }),
});

// CLM-012: exported so contract/registry.ts can document the real
// numbers instead of a vague "best-effort" description with no figures.
export const RATE_LIMIT_WINDOW_MS = V1_RATE_LIMIT_WINDOW_MS;
export const RATE_LIMIT_MAX = V1_RATE_LIMIT_MAX;

const API_V1_RATE_LIMIT_POLICY = getRequestRateLimitPolicy("public-api-v1");

export function corsOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": cacheControlFor("public-live"),
    },
  });
}

export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": cacheControlFor("public-live"),
    },
  });
}

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "RELEASE_INCONSISTENT"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

function defaultApiErrorCode(status: number): ApiErrorCode {
  if (status === 400 || status === 422) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  return "INTERNAL_ERROR";
}

export function apiError(
  message: string,
  status: number,
  code: ApiErrorCode = defaultApiErrorCode(status),
) {
  return NextResponse.json(
    { error: message, code },
    {
      status,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": cacheControlFor("public-live"),
      },
    },
  );
}

export async function withRateLimit(
  request: Request,
): Promise<NextResponse | null> {
  return enforceRequestRateLimit(request, API_V1_RATE_LIMIT_POLICY, {
    headers: CORS_HEADERS,
  });
}
