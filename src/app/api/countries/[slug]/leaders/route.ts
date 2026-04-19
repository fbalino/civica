import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getLeaderTimeline } from "@/lib/db/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawLeaders = await getLeaderTimeline(jurisdiction.id);

  // Deduplicate: group by person+office, keep the term with the earliest start date
  const seen = new Map<string, typeof rawLeaders[number]>();
  for (const l of rawLeaders) {
    const key = `${l.personName}::${l.officeName}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, l);
    } else if (l.isCurrent && !existing.isCurrent) {
      seen.set(key, l);
    } else if (l.isCurrent === existing.isCurrent && l.startDate && existing.startDate && l.startDate < existing.startDate) {
      seen.set(key, { ...l, endDate: existing.endDate });
    }
  }
  const leaders = Array.from(seen.values());

  return NextResponse.json({
    country: jurisdiction.name,
    leaders,
  });
}
