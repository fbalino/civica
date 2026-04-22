import { NextResponse } from "next/server";

/**
 * Verify that an incoming cron-endpoint request was triggered by Vercel Cron
 * (or an authorized operator). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 *
 * Returns null on success; returns a 401 NextResponse if the request is
 * unauthorized. The caller should: `const bad = requireCronAuth(req); if (bad) return bad;`.
 */
export function requireCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server" },
      { status: 500 }
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
