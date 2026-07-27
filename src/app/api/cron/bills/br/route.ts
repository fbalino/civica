import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchBRBillsForSync } from "@/lib/bills/sources/camara-senado-br";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const started = new Date().toISOString();
  const summary = await runBillsSync(db, {
    dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
    jurisdictionSlug: "brazil",
    iso2: "BR",
    fetchDrafts: ({ jurisdictionId }) =>
      fetchBRBillsForSync({ jurisdictionId, db, limit: 50 }),
  });
  return NextResponse.json({
    ok: true,
    step: "bills.br",
    started,
    finished: new Date().toISOString(),
    summary,
  });
}

const cronHandler = withCronJob("bills.br", handler);

export { cronHandler as GET, cronHandler as POST };
