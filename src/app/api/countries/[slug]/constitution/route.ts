import { NextResponse } from "next/server";
import { getJurisdictionBySlug, getConstitution } from "@/lib/db/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const constitution = await getConstitution(jurisdiction.id);

  return NextResponse.json({
    country: jurisdiction.name,
    year: constitution?.year ?? null,
    yearUpdated: constitution?.yearUpdated ?? null,
    hasFullText: !!constitution?.fullTextHtml,
    fullTextHtml: constitution?.fullTextHtml ?? null,
    constituteProjectId: constitution?.constituteProjectId ?? null,
  });
}
