import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getDemocracyScores, getRegionalDemocracyComparison } from "@/lib/db/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scores = await getDemocracyScores(jurisdiction.id);
  const regional = await getRegionalDemocracyComparison(jurisdiction.id, scores.continent);

  return NextResponse.json({
    country: jurisdiction.name,
    democracyIndex: scores.democracyIndex,
    freedomHouseFacts: scores.freedomHouseFacts,
    regionalComparison: regional,
  });
}
