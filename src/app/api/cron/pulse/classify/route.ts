import { withCronJob } from "@/lib/api/cron-job";
import { retiredPulseV1CronResponse } from "@/lib/pulse/v1-retirement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  return retiredPulseV1CronResponse("classify");
}

const cronHandler = withCronJob("pulse.v1.classify", handler);

export { cronHandler as GET, cronHandler as POST };
