import { withCronJob } from "@/lib/api/cron-job";
import { billsCronResponse } from "@/lib/bills/cron-response";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchUKBillsForSync } from "@/lib/bills/sources/uk-parliament";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  return billsCronResponse("bills.uk", () =>
    runBillsSync(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      jurisdictionSlug: "united-kingdom",
      iso2: "GB",
      fetchDrafts: ({ jurisdictionId }) =>
        fetchUKBillsForSync({ jurisdictionId, limit: 100 }),
    }),
  );
}

const cronHandler = withCronJob("bills.uk", handler);

export { cronHandler as GET, cronHandler as POST };
