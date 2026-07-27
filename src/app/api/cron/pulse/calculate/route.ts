import { requireCronAuth } from "@/lib/api/cron-auth";
import { retiredPulseV1CronResponse } from "@/lib/pulse/v1-retirement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  return retiredPulseV1CronResponse("calculate");
}

export { handler as GET, handler as POST };
