import { NextResponse } from "next/server";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import { fetchParliamentBills } from "@/lib/data/parliament-feeds";

function statusToStage(status: string): number {
  const s = status.toLowerCase();
  if (s.includes("enacted") || s.includes("became law") || s.includes("royal assent")) return 4;
  if (s.includes("passed") || s.includes("agreed")) return 3;
  if (s.includes("floor") || s.includes("reading") || s.includes("referred to")) return 2;
  if (s.includes("committee")) return 1;
  return 0;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let jurisdiction;
  try {
    jurisdiction = await getJurisdictionBySlug(slug);
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
  if (!jurisdiction) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rawBills = await fetchParliamentBills(jurisdiction.iso2);
  const bills = rawBills.map((b) => ({
    title: b.title,
    summary: b.summary ?? b.status,
    status: b.status,
    sponsor: b.identifier ?? b.source.replace(/_/g, " "),
    tags: [b.source === "congress_gov" ? "U.S. Congress" : b.source === "uk_parliament" ? "UK Parliament" : b.source],
    stage: statusToStage(b.status),
    votes: null,
    url: b.url,
    date: b.date,
  }));
  return NextResponse.json({ country: jurisdiction.name, bills });
}
