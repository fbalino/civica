import type { Metadata } from "next";
import { getUpcomingElections, getRecentElectionsWithResults } from "@/lib/db/queries";
import { db } from "@/lib/db/index";
import { elections, jurisdictions } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import ElectionsClient from "./ElectionsClient";

export const metadata: Metadata = {
  title: "Election Timeline & Results — Upcoming and Past Elections Worldwide",
  description:
    "Track upcoming and past elections worldwide. Voter turnout data, party-colored results, electoral system labels, and historical timelines for 200+ countries.",
  alternates: { canonical: "https://civicaatlas.org/elections" },
  openGraph: {
    title: "Election Timeline & Results | Civica",
    description:
      "Track upcoming and past elections worldwide with turnout visualization and party-colored results.",
    url: "https://civicaatlas.org/elections",
  },
};

export default async function ElectionsPage() {
  let upcoming: Awaited<ReturnType<typeof getUpcomingElections>> = [];
  let recent: Awaited<ReturnType<typeof getRecentElectionsWithResults>> = [];
  let stats = { totalElections: 0, upcomingCount: 0, avgTurnout: 0, electionsThisYear: 0 };

  try {
    [upcoming, recent] = await Promise.all([
      getUpcomingElections(20),
      getRecentElectionsWithResults(40),
    ]);

    const [statsRow] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        upcoming: sql<number>`COUNT(*) FILTER (WHERE ${elections.electionDate} >= CURRENT_DATE)`,
        avgTurnout: sql<number>`ROUND(AVG(${elections.turnoutPercent}) FILTER (WHERE ${elections.turnoutPercent} IS NOT NULL), 1)`,
        thisYear: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM ${elections.electionDate}::date) = EXTRACT(YEAR FROM CURRENT_DATE))`,
      })
      .from(elections)
      .innerJoin(jurisdictions, sql`${elections.jurisdictionId} = ${jurisdictions.id}`)
      .where(sql`${jurisdictions.type} = 'sovereign_state'`);

    stats = {
      totalElections: Number(statsRow?.total ?? 0),
      upcomingCount: Number(statsRow?.upcoming ?? 0),
      avgTurnout: Number(statsRow?.avgTurnout ?? 0),
      electionsThisYear: Number(statsRow?.thisYear ?? 0),
    };
  } catch {
    // DB not yet seeded
  }

  return <ElectionsClient upcoming={upcoming} recent={recent} stats={stats} />;
}
