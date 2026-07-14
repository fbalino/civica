import { NextResponse } from "next/server";
import {
  getJurisdictionBySlug,
  getDemocracyScores,
  getRegionalDemocracyComparison,
} from "@/lib/db/queries";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { parsePathContract } from "@/lib/api/request-contract";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return withSafeJsonErrors("api/countries/[slug]/democracy", async () => {
    const limited = await enforceRequestRateLimit(
      req,
      getRequestRateLimitPolicy("public-dynamic-read"),
    );
    if (limited) return limited;

    const path = await parsePathContract(params, "jurisdiction-slug-params/v1");
    if (!path.ok) return path.response;
    const { slug } = path.data;
    const jurisdiction = await getJurisdictionBySlug(slug);
    if (!jurisdiction) return apiProblem("NOT_FOUND");

    const scores = await getDemocracyScores(jurisdiction.id);
    const regional = await getRegionalDemocracyComparison(
      jurisdiction.id,
      scores.continent,
    );

    return NextResponse.json({
      country: jurisdiction.name,
      democracyIndex: scores.democracyIndex,
      freedomHouseFacts: scores.freedomHouseFacts,
      regionalComparison: regional,
    });
  });
}
