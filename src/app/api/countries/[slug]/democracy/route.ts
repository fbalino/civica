import { NextResponse } from "next/server";
import {
  getJurisdictionBySlug,
  getDemocracyScores,
  getRegionalDemocracyComparison,
} from "@/lib/db/queries";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limited = await enforceRequestRateLimit(
    req,
    getRequestRateLimitPolicy("public-dynamic-read"),
  );
  if (limited) return limited;

  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

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
}
