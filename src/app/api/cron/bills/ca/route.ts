import { withCronJob } from "@/lib/api/cron-job";
import { billsCronResponse } from "@/lib/bills/cron-response";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchCABillsForSync } from "@/lib/bills/sources/legisinfo-ca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  return billsCronResponse("bills.ca", () =>
    runBillsSync(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      jurisdictionSlug: "canada",
      iso2: "CA",
      fetchDrafts: ({ jurisdictionId }) =>
        fetchCABillsForSync({ jurisdictionId, db, limit: 100 }),
    }),
  );
}

const cronHandler = withCronJob("bills.ca", handler);

export { cronHandler as GET, cronHandler as POST };
