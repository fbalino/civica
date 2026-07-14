import {
  ConstitutionSearchQueryError,
  searchConstitutionPassages,
} from "@/lib/db/queries-constitution-search";
import type { ConstitutionSearchErrorCode } from "@/lib/constitution/search-contract";
import { shapeConstitutionSearchError } from "@/lib/constitution/search-error-response";
import { checkRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { constitutionSearchRateLimitResponse } from "@/lib/constitution/search-rate-limit-response";
import { parseQueryContract } from "@/lib/api/request-contract";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const RATE_LIMIT_POLICY = getRequestRateLimitPolicy("constitution-search");

function errorResponse(
  error: ConstitutionSearchErrorCode,
  details?: { uncoveredJurisdictions: string[] },
  headers?: HeadersInit,
) {
  const shaped = shapeConstitutionSearchError(error, details);
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return Response.json(shaped.body, {
    status: shaped.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request) {
  try {
    const rateLimit = await checkRequestRateLimit(request, RATE_LIMIT_POLICY);
    if (rateLimit.status !== "allowed") {
      return constitutionSearchRateLimitResponse(rateLimit, RATE_LIMIT_POLICY);
    }

    const query = parseQueryContract(request, "constitution-search-query/v1");
    if (!query.ok) return query.response;
    const response = await searchConstitutionPassages({
      query: query.data.q,
      jurisdictions: query.data.jurisdiction,
      topics: query.data.topic,
      language: query.data.language,
      limit: query.data.limit,
      cursor: query.data.cursor ?? null,
    });
    return Response.json(response, {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    if (error instanceof ConstitutionSearchQueryError) {
      return errorResponse(
        error.code,
        error.details,
        error.code === "rate_limited" ? { "Retry-After": "60" } : undefined,
      );
    }
    console.error("[/api/constitution/search]", error);
    return errorResponse("data_unavailable");
  }
}
