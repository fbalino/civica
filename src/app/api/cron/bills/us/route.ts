import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchUSBillsForSync } from "@/lib/bills/sources/us-congress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const summary = await runBillsSync(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      jurisdictionSlug: "united-states",
      iso2: "US",
      fetchDrafts: ({ jurisdictionId }) =>
        fetchUSBillsForSync({ jurisdictionId, limit: 100 }),
    });
    return NextResponse.json({
      ok: true,
      step: "bills.us",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron bills.us] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "bills.us",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
