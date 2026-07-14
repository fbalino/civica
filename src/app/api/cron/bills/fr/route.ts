import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchFRBillsForSync } from "@/lib/bills/sources/an-senat-fr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const started = new Date().toISOString();
  try {
    const summary = await runBillsSync(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
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

const cronHandler = withCronJob("bills.fr", handler);

export { cronHandler as GET, cronHandler as POST };
