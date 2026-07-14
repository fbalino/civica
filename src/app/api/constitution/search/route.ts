import {
  ConstitutionSearchQueryError,
  searchConstitutionPassages,
} from "@/lib/db/queries-constitution-search";
import {
  CONSTITUTION_SEARCH_DEFAULT_LIMIT,
  CONSTITUTION_SEARCH_SCHEMA_VERSION,
  type ConstitutionSearchErrorResponse,
} from "@/lib/constitution/search-contract";
import { checkRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { constitutionSearchRateLimitResponse } from "@/lib/constitution/search-rate-limit-response";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const RATE_LIMIT_POLICY = getRequestRateLimitPolicy("constitution-search");

function errorResponse(
  error: ConstitutionSearchErrorResponse["error"],
  message: string,
  status: number,
  headers?: HeadersInit,
  details?: ConstitutionSearchErrorResponse["details"],
) {
  return Response.json(
    {
      schemaVersion: CONSTITUTION_SEARCH_SCHEMA_VERSION,
      error,
      message,
      ...(details ? { details } : {}),
    },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

export async function GET(request: Request) {
  const rateLimit = await checkRequestRateLimit(request, RATE_LIMIT_POLICY);
  if (rateLimit.status !== "allowed") {
    return constitutionSearchRateLimitResponse(rateLimit, RATE_LIMIT_POLICY);
  }

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const limit =
    rawLimit == null ? CONSTITUTION_SEARCH_DEFAULT_LIMIT : Number(rawLimit);
  try {
    const response = await searchConstitutionPassages({
      query: url.searchParams.get("q") ?? "",
      jurisdictions: url.searchParams.getAll("jurisdiction"),
      topics: url.searchParams.getAll("topic"),
      language: (url.searchParams.get("language") ?? "en") as "en",
      limit,
      cursor: url.searchParams.get("cursor"),
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
        error.message,
        error.status,
        error.code === "rate_limited" ? { "Retry-After": "60" } : undefined,
        error.details,
      );
    }
    console.error("[/api/constitution/search]", error);
    return errorResponse(
      "data_unavailable",
      "The constitution search index is unavailable.",
      503,
    );
  }
}
