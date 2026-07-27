import { withCronJob } from "@/lib/api/cron-job";
import { retiredPulseV1CronResponse } from "@/lib/pulse/v1-retirement";

export const runtime = "nodejs";
// Vercel Cron hits this as GET; allow POST too for manual triggering.
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  return retiredPulseV1CronResponse("ingest");
}

const cronHandler = withCronJob("pulse.v1.ingest", handler);

export { cronHandler as GET, cronHandler as POST };
