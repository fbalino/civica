import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchCABillsForSync } from "@/lib/bills/sources/legisinfo-ca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const started = new Date().toISOString();
  const summary = await runBillsSync(db, {
    dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
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
}

const cronHandler = withCronJob("bills.ca", handler);

export { cronHandler as GET, cronHandler as POST };
