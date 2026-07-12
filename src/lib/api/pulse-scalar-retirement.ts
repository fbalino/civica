import { NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/api/helpers";

/**
 * Terminal contract for the abandoned scalar Pulse score. Pulse v2 publishes
 * named, per-dimension experimental deltas; it does not publish a scalar score
 * or a country ranking.
 */
export const PULSE_SCALAR_SUCCESSOR_HREF =
  "/api/v1/pulse/{country_slug}/dimensions" as const;
export const PULSE_SCALAR_SUNSET_DATE =
  "Sat, 11 Jul 2026 23:59:59 GMT" as const;

export const PULSE_SCALAR_RETIREMENT_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  Deprecation: "true",
  Sunset: PULSE_SCALAR_SUNSET_DATE,
  Link: `<${PULSE_SCALAR_SUCCESSOR_HREF}>; rel="successor-version"`,
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

export function retiredPulseScalarResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "Scalar Civica Pulse scores and rankings have been retired.",
      code: "pulse_scalar_retired",
      disposition: "named_per_dimension_deltas_only",
      successor: PULSE_SCALAR_SUCCESSOR_HREF,
      scalarPulseScore: false,
    },
    { status: 410, headers: PULSE_SCALAR_RETIREMENT_HEADERS },
  );
}
