import { NextResponse } from "next/server";
import { getUpcomingElections, getRecentElectionsWithResults } from "@/lib/db/queries";

export const runtime = "edge";

export async function GET() {
  try {
    const [upcoming, recent] = await Promise.all([
      getUpcomingElections(20),
      getRecentElectionsWithResults(40),
    ]);
    return NextResponse.json({ upcoming, recent });
  } catch {
    return NextResponse.json({ upcoming: [], recent: [] });
  }
}
