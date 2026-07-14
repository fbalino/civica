import { NextRequest, NextResponse } from "next/server";
import { guardAdminMutationRequest } from "@/lib/api/admin-mutation-request-guard";
import { buildPulseCodingClearCookieHeaders } from "@/lib/pulse/v2/coding-session";

export async function POST(request: NextRequest) {
  const mutationGuard = guardAdminMutationRequest(request);
  if (!mutationGuard.ok) return mutationGuard.response;

  const response = NextResponse.redirect(
    new URL("/admin/pulse-coding/sign-in", request.url),
    303,
  );
  for (const [name, value] of buildPulseCodingClearCookieHeaders())
    response.headers.append(name, value);
  return response;
}
