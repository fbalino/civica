import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchFRBillsForSync } from "@/lib/bills/sources/an-senat-fr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const summary = await runBillsSync(db, {
      jurisdictionSlug: "france",
      iso2: "FR",
      fetchDrafts: ({ jurisdictionId }) =>
        fetchFRBillsForSync({ jurisdictionId, db, limit: 50 }),
    });
    return NextResponse.json({
      ok: true,
      step: "bills.fr",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron bills.fr] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "bills.fr",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
