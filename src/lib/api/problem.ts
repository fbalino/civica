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

/** Edge-safe fixed error envelope shared by request parsers and route boundaries. */
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
