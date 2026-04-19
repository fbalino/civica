import { NextResponse } from "next/server";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import { fetchParliamentBills } from "@/lib/data/parliament-feeds";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let jurisdiction;
  try {
    jurisdiction = await getJurisdictionBySlug(slug);
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
  if (!jurisdiction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bills = await fetchParliamentBills(jurisdiction.iso2);
  return NextResponse.json({ country: jurisdiction.name, bills });
}
