import { unstable_rethrow } from "next/navigation";
import {
  responseWithCacheProfile,
  type HttpResponseCacheProfileId,
} from "@/lib/api/response-cache";

export const API_PROBLEMS = Object.freeze({
  INVALID_QUERY: {
    status: 400,
    error: "Invalid query parameters.",
  },
  INVALID_PATH: {
    status: 400,
    error: "Invalid path parameters.",
  },
  UNAUTHORIZED: { status: 401, error: "Unauthorized." },
  FORBIDDEN: { status: 403, error: "Forbidden." },
  NOT_FOUND: { status: 404, error: "Not found." },
  CONFLICT: { status: 409, error: "The request conflicts with current state." },
  DATA_UNAVAILABLE: {
    status: 503,
    error: "The requested data is temporarily unavailable.",
  },
  ARTIFACT_UNAVAILABLE: {
    status: 503,
    error: "The requested artifact is temporarily unavailable.",
  },
  RELEASE_INCONSISTENT: {
    status: 503,
    error: "The requested release is temporarily unavailable.",
  },
  INTERNAL_ERROR: {
    status: 500,
    error: "The request could not be completed.",
  },
} as const);

export type ApiProblemCode = keyof typeof API_PROBLEMS;

export function apiProblem(
  code: ApiProblemCode,
  options: { headers?: HeadersInit } = {},
): Response {
  const problem = API_PROBLEMS[code];
  return Response.json(
    { error: problem.error, code },
    {
      status: problem.status,
      headers: {
        "Cache-Control": "no-store",
        ...Object.fromEntries(new Headers(options.headers).entries()),
      },
    },
  );
}

/**
 * Fixed unknown-error boundary for ordinary JSON routes. The exception is
 * logged server-side only; no caller-controlled or provider detail can enter
 * the response body or influence its status.
 */
export async function withSafeJsonErrors(
  operation: string,
  handler: () => Response | Promise<Response>,
  options: {
    errorHeaders?: HeadersInit;
    cacheProfileId?: HttpResponseCacheProfileId;
  } = {},
): Promise<Response> {
  const cacheProfileId = options.cacheProfileId ?? "public-live";
  try {
    const response = await handler();
    return responseWithCacheProfile(response, cacheProfileId);
  } catch (error) {
    // Preserve Next.js control-flow and dynamic-rendering signals while
    // converting only ordinary application failures to the public problem.
    unstable_rethrow(error);
    console.error(`[${operation}] unhandled route failure`, error);
    return responseWithCacheProfile(
      apiProblem("DATA_UNAVAILABLE", {
        headers: options.errorHeaders,
      }),
      cacheProfileId,
    );
  }
}

/** Fixed-error boundary for authenticated or PII-bearing live routes. */
export function withPrivateSafeJsonErrors(
  operation: string,
  handler: () => Response | Promise<Response>,
  options: { errorHeaders?: HeadersInit } = {},
): Promise<Response> {
  return withSafeJsonErrors(operation, handler, {
    ...options,
    cacheProfileId: "private-live",
  });
}
