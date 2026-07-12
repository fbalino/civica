import {
  ConstitutionSearchQueryError,
  searchConstitutionPassages,
} from "@/lib/db/queries-constitution-search";
import {
  CONSTITUTION_SEARCH_DEFAULT_LIMIT,
  CONSTITUTION_SEARCH_SCHEMA_VERSION,
  type ConstitutionSearchErrorResponse,
} from "@/lib/constitution/search-contract";
import { checkDurableRateLimit, getRequestIp } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

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
  const limited = await checkDurableRateLimit({
    scope: "constitution-search",
    key: getRequestIp(request),
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return errorResponse(
      "rate_limited",
      "Rate limit exceeded. Try again shortly.",
      429,
      {
        "Retry-After": String(
          Math.max(1, Math.ceil(limited.retryAfterMs / 1000)),
        ),
      },
    );
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
        undefined,
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
