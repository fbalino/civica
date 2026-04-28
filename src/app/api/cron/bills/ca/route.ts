import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchCABillsForSync } from "@/lib/bills/sources/legisinfo-ca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const summary = await runBillsSync(db, {
      jurisdictionSlug: "canada",
      iso2: "CA",
      fetchDrafts: ({ jurisdictionId }) =>
        fetchCABillsForSync({ jurisdictionId, db, limit: 100 }),
    });
    return NextResponse.json({
      ok: true,
      step: "bills.ca",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron bills.ca] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "bills.ca",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
