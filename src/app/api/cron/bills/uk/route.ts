import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchUKBillsForSync } from "@/lib/bills/sources/uk-parliament";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const started = new Date().toISOString();
  try {
    const summary = await runBillsSync(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      jurisdictionSlug: "united-kingdom",
      iso2: "GB",
      fetchDrafts: ({ jurisdictionId }) =>
        fetchUKBillsForSync({ jurisdictionId, limit: 100 }),
    });
    return NextResponse.json({
      ok: true,
      step: "bills.uk",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron bills.uk] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "bills.uk",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("bills.uk", handler);

export { cronHandler as GET, cronHandler as POST };
