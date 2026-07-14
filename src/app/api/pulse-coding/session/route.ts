import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { guardAdminMutationRequest } from "@/lib/api/admin-mutation-request-guard";
import { authenticatePulseCodingAccessCode } from "@/lib/pulse/v2/coding-session";

export async function POST(request: NextRequest) {
  const mutationGuard = guardAdminMutationRequest(request);
  if (!mutationGuard.ok) return mutationGuard.response;

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
