import { apiResponse, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { zPulseClusterCoverageReport } from "@/lib/api/contract/schemas";
import report from "@/lib/pulse/v2/cluster-coverage.generated.json";

// PUBLIC_CLAIM: pulse.cluster-coverage-release
export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;
  return apiResponse({
    data: zPulseClusterCoverageReport.strict().parse(report),
  });
}

export async function OPTIONS() {
  return corsOptions();
}
