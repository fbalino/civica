import { withCronJob } from "@/lib/api/cron-job";
import { billsCronResponse } from "@/lib/bills/cron-response";
import { db } from "@/lib/db";
import { runBillsSync } from "@/lib/bills/sync";
import { fetchFRBillsForSync } from "@/lib/bills/sources/an-senat-fr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  return billsCronResponse("bills.fr", () =>
    runBillsSync(db, {
      dryRun: new URL(request.url).searchParams.get("dryRun") === "1",
      jurisdictionSlug: "france",
      iso2: "FR",
      fetchDrafts: ({ jurisdictionId }) =>
        fetchFRBillsForSync({ jurisdictionId, db, limit: 50 }),
    }),
  );
}

const cronHandler = withCronJob("bills.fr", handler);

export { cronHandler as GET, cronHandler as POST };
