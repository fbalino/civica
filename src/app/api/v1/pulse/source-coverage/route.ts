import {
  apiError,
  apiResponse,
  corsOptions,
  withRateLimit,
} from "@/lib/api/helpers";
import { zPulseSourceCoverageReport } from "@/lib/api/contract/schemas";
import { loadPulseSourceCoverageReport } from "@/lib/pulse/v2/source-coverage";

export async function GET(request: Request) {
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return rateLimited;
  try {
    // PUBLIC_CLAIM: pulse.source-coverage-runtime
    const report = await loadPulseSourceCoverageReport();
    return apiResponse({ data: zPulseSourceCoverageReport.parse(report) });
  } catch (error) {
    console.error("Pulse source coverage failed", error);
    return apiError("Pulse source coverage is temporarily unavailable", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
