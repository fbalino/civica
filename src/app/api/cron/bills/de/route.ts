import { withCronJob } from "@/lib/api/cron-job";
import { billsCronResponse } from "@/lib/bills/cron-response";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchDEBillsForSync } from "@/lib/bills/sources/bundestag-dip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  return billsCronResponse("bills.de", () =>
    runBillsSync(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      jurisdictionSlug: "germany",
      iso2: "DE",
      fetchDrafts: ({ jurisdictionId }) =>
        fetchDEBillsForSync({ jurisdictionId, db, limit: 100 }),
    }),
  );
}

const cronHandler = withCronJob("bills.de", handler);

export { cronHandler as GET, cronHandler as POST };
