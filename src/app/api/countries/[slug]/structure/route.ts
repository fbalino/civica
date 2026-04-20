import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getGovernmentStructure } from "@/lib/db/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { bodies, offices, currentTerms } = await getGovernmentStructure(
    jurisdiction.id
  );

  return NextResponse.json({
    country: jurisdiction.name,
    bodies: bodies.map((b) => ({
      id: b.id,
      name: b.name,
      branch: b.branch,
      bodyType: b.bodyType,
      hierarchyLevel: b.hierarchyLevel,
    })),
    offices: offices.map((o) => ({
      id: o.id,
      bodyId: o.bodyId,
      name: o.name,
      officeType: o.officeType,
    })),
    currentTerms: currentTerms.map((t) => ({
      term: { officeId: t.term.officeId },
      person: {
        name: t.person.name,
        photoUrl: t.person.photoUrl,
      },
    })),
  });
}
