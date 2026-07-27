import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { guardAdminMutationRequest } from "@/lib/api/admin-mutation-request-guard";
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { authenticatePulseCodingAccessCode } from "@/lib/pulse/v2/coding-session";
import {
  FORM_MEDIA_TYPE,
  parseBoundedRequestBody,
} from "@/lib/api/request-body";
import {
  pulseCodingLoginFormSchema,
  REQUEST_BODY_LIMITS,
  type PulseCodingLoginBody,
} from "@/lib/api/request-body-schemas";
import { withPrivateSafeJsonErrors } from "@/lib/api/problem-response";

const PULSE_CREDENTIAL_RATE_LIMIT_POLICY = getRequestRateLimitPolicy(
  "pulse-credential-bootstrap",
);

export async function POST(request: NextRequest) {
  return withPrivateSafeJsonErrors("api/pulse-coding/session", async () => {
    const mutationGuard = guardAdminMutationRequest(request);
    if (!mutationGuard.ok) return mutationGuard.response;

    const rateLimit = await checkRequestRateLimit(
      request,
      PULSE_CREDENTIAL_RATE_LIMIT_POLICY,
    );
    if (rateLimit.status !== "allowed") {
      return rateLimitResponse(rateLimit, PULSE_CREDENTIAL_RATE_LIMIT_POLICY, {
        limitedMessage:
          "Too many access-code attempts. Please wait before trying again.",
      });
    }

    const parsed = await parseBoundedRequestBody<PulseCodingLoginBody>(
      request,
      {
        maxBytes: REQUEST_BODY_LIMITS.pulseCodingLogin,
        media: [
          { mediaType: FORM_MEDIA_TYPE, schema: pulseCodingLoginFormSchema },
        ],
      },
    );
    if (!parsed.ok) return parsed.response;
    const accessCode = parsed.data.accessCode;
    const result = await authenticatePulseCodingAccessCode(
      accessCode,
      randomUUID(),
    );
    if (!result) {
      const response = NextResponse.redirect(
        new URL("/admin/pulse-coding/sign-in?error=invalid", request.url),
        303,
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    const response = NextResponse.redirect(
      new URL("/admin/pulse-coding", request.url),
      303,
    );
    for (const [name, value] of result.cookieHeaders)
      response.headers.append(name, value);
    return response;
  });
}
