import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchDEBillsForSync } from "@/lib/bills/sources/bundestag-dip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const summary = await runBillsSync(db, {
      jurisdictionSlug: "germany",
      iso2: "DE",
      fetchDrafts: ({ jurisdictionId }) =>
        fetchDEBillsForSync({ jurisdictionId, db, limit: 100 }),
    });
    return NextResponse.json({
      ok: true,
      step: "bills.de",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron bills.de] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "bills.de",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
