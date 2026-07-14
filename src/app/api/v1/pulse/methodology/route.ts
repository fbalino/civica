import { apiResponse, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { createPulseRuntimeMethodSnapshot } from "@/lib/pulse/v2/runtime-contract";

/** Machine-readable snapshot of the Pulse method currently scheduled.
 * It explicitly does not retroactively version mixed legacy ledger rows. */
export async function GET(request: Request) {
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return rateLimited;

  return apiResponse({ data: createPulseRuntimeMethodSnapshot() });
}

export async function OPTIONS() {
  return corsOptions();
}
