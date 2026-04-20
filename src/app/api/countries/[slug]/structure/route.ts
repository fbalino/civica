import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getGovernmentHierarchy } from "@/lib/db/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { bodies, offices, currentTerms, parties } =
    await getGovernmentHierarchy(jurisdiction.id);

  return NextResponse.json({
    country: jurisdiction.name,
    bodies: bodies.map((b) => ({
      id: b.id,
      name: b.name,
      branch: b.branch,
      bodyType: b.bodyType,
      chamberType: b.chamberType,
      totalSeats: b.totalSeats,
      hierarchyLevel: b.hierarchyLevel,
      parentBodyId: b.parentBodyId ?? null,
    })),
    offices: offices.map((o) => ({
      id: o.id,
      bodyId: o.bodyId,
      name: o.name,
      officeType: o.officeType,
      reportsToOfficeId: o.reportsToOfficeId ?? null,
    })),
    currentTerms: currentTerms.map((t) => ({
      term: {
        officeId: t.term.officeId,
        partyName: t.term.partyName,
        partyColor: t.term.partyColor,
        startDate: t.term.startDate,
        endDate: t.term.endDate,
      },
      person: {
        name: t.person.name,
        photoUrl: t.person.photoUrl,
        wikidataQid: t.person.wikidataQid,
      },
    })),
    parties: parties.map((p) => ({
      bodyId: p.bodyId,
      partyName: p.partyName,
      partyColor: p.partyColor,
      seatCount: p.seatCount,
      isRulingCoalition: p.isRulingCoalition,
    })),
  });
}
