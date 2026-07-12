import { NextRequest, NextResponse } from "next/server";
import { buildPulseCodingClearCookieHeaders } from "@/lib/pulse/v2/coding-session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/admin/pulse-coding/sign-in", request.url),
    303,
  );
  for (const [name, value] of buildPulseCodingClearCookieHeaders())
    response.headers.append(name, value);
  return response;
}
