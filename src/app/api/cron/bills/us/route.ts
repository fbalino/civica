import { withCronJob } from "@/lib/api/cron-job";
import { billsCronResponse } from "@/lib/bills/cron-response";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchUSBillsForSync } from "@/lib/bills/sources/us-congress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  return billsCronResponse("bills.us", () =>
    runBillsSync(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      jurisdictionSlug: "united-states",
      iso2: "US",
      fetchDrafts: ({ jurisdictionId }) =>
        fetchUSBillsForSync({ jurisdictionId, limit: 100 }),
    }),
  );
}

const cronHandler = withCronJob("bills.us", handler);

export { cronHandler as GET, cronHandler as POST };
