import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getLeaderTimeline } from "@/lib/db/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const leaders = await getLeaderTimeline(jurisdiction.id);

  return NextResponse.json({
    country: jurisdiction.name,
    leaders,
  });
}
