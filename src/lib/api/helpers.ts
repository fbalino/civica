import { NextResponse } from "next/server";
import { civicaIndex } from "@/lib/content/site-state";
import { CURRENT_PULSE_RUNTIME_METHOD } from "@/lib/pulse/v2/runtime-contract";
import { checkInMemoryRateLimit, getRequestIp } from "@/lib/api/rate-limit";

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
  status: civicaIndex.status,
  standing: "secondary_research_experiment" as const,
  independent_validation: false as const,
  atlas_dependency: false as const,
  last_revised: civicaIndex.lastRevisionIso,
  reference: "https://civicaatlas.org/civica-index/methodology",
  presentation: Object.freeze({
    format: "numeric_position",
    scale: Object.freeze({ min: 0, max: 100 }),
    input_variation_range: "central_90_percent",
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
    : "current",
  presentation: Object.freeze({
    format: CURRENT_PULSE_RUNTIME_METHOD.numericDeltas.shape,
    public_status: CURRENT_PULSE_RUNTIME_METHOD.numericDeltas.publicStatus,
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
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 60;

function getRateLimitKey(request: Request): string {
  return getRequestIp(request);
}

export function corsOptions() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: CORS_HEADERS });
}

export function withRateLimit(request: Request): NextResponse | null {
  const key = getRateLimitKey(request);
  const { allowed, retryAfterSeconds } = checkInMemoryRateLimit({
    scope: "api-v1",
    key,
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}
