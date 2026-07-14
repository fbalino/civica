import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { guardAdminMutationRequest } from "@/lib/api/admin-mutation-request-guard";
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { authenticatePulseCodingAccessCode } from "@/lib/pulse/v2/coding-session";

const PULSE_CREDENTIAL_RATE_LIMIT_POLICY = getRequestRateLimitPolicy(
  "pulse-credential-bootstrap",
);

export async function POST(request: NextRequest) {
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

  const form = await request.formData();
  const accessCode = String(form.get("accessCode") ?? "");
  const result = await authenticatePulseCodingAccessCode(
    accessCode,
    randomUUID(),
  );
  if (!result) {
    return NextResponse.redirect(
      new URL("/admin/pulse-coding/sign-in?error=invalid", request.url),
      303,
    );
  }
  const response = NextResponse.redirect(
    new URL("/admin/pulse-coding", request.url),
    303,
  );
  for (const [name, value] of result.cookieHeaders)
    response.headers.append(name, value);
  return response;
}
