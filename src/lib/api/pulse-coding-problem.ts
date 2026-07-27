import { apiProblem } from "@/lib/api/problem-response";
import { requestInputErrorResponse } from "@/lib/api/request-body";
import { PulseCodingStoreError } from "@/lib/pulse/v2/coding-errors";

/** Convert a typed store failure to one fixed, no-store public response. */
export function pulseCodingProblem(
  operation: string,
  error: unknown,
): Response {
  if (error instanceof PulseCodingStoreError) {
    switch (error.code) {
      case "FORBIDDEN":
        return apiProblem("FORBIDDEN");
      case "NOT_FOUND":
        return apiProblem("NOT_FOUND");
      case "CONFLICT":
        return apiProblem("CONFLICT");
      case "INVALID_REQUEST_BODY":
        return requestInputErrorResponse("INVALID_REQUEST_BODY");
    }
  }

  console.error(`[${operation}] unhandled Pulse coding failure`, error);
  return apiProblem("DATA_UNAVAILABLE");
}
