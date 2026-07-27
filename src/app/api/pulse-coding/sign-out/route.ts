import { NextRequest, NextResponse } from "next/server";
import { guardAdminMutationRequest } from "@/lib/api/admin-mutation-request-guard";
import { buildPulseCodingClearCookieHeaders } from "@/lib/pulse/v2/coding-session";
import { withResponseCacheProfile } from "@/lib/api/response-cache";

async function handleSignOut(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/admin/pulse-coding/sign-in", request.url),
    303,
  );
  for (const [name, value] of buildPulseCodingClearCookieHeaders())
    response.headers.append(name, value);
  return response;
}

export async function POST(request: NextRequest) {
  return withResponseCacheProfile("private-live", () => {
    const mutationGuard = guardAdminMutationRequest(request);
    if (!mutationGuard.ok) return mutationGuard.response;
    return handleSignOut(request);
  });
}
