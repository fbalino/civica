import type { Metadata } from "next";
import {
  getUpcomingElections,
  getRecentElectionsWithResults,
  getSource,
} from "@/lib/db/queries";
import { db } from "@/lib/db/index";
import { elections, jurisdictions } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import ElectionsClient from "./ElectionsClient";
import { withOg } from "@/lib/og";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Elections Around the World — Calendar & Results",
  description:
    "A worldwide election calendar: legislative dates, electoral systems, and party seat results from IPU Parline, plus presidential elections from Wikidata and voter turnout from International IDEA.",
  alternates: { canonical: "https://civicaatlas.org/elections" },
  openGraph: withOg({
    title: "Elections Around the World — Calendar & Results · Civica Atlas",
    description:
      "A worldwide election calendar: legislative dates and party seat results from IPU Parline, presidential elections from Wikidata, and voter turnout from International IDEA.",
    url: "https://civicaatlas.org/elections",
  }),
};

export default async function ElectionsPage() {
  let upcoming: Awaited<ReturnType<typeof getUpcomingElections>> = [];
  let recent: Awaited<ReturnType<typeof getRecentElectionsWithResults>> = [];
  let stats = { totalElections: 0, upcomingCount: 0, avgTurnout: 0, electionsThisYear: 0 };
  // Sourced coverage framing (resolution §3, §5): legislative dates from IPU
  // Parline, presidential dates from Wikidata, turnout from International IDEA.
  // Numbers are live-from-DB so the foot-of-page sources note can never overstate
  // coverage; all soft-fail to null when the DB is unreachable, and the client
  // renders a static sourced line in that case.
  let coverage: {
    legislativeJurisdictions: number;
    presidentialJurisdictions: number;
    turnoutJurisdictions: number;
    estimatedJurisdictions: number;
    ipuRetrievedAt: string | null;
    wikidataRetrievedAt: string | null;
    ideaRetrievedAt: string | null;
  } | null = null;

  try {
    [upcoming, recent] = await Promise.all([
      getUpcomingElections(60),
      // Load every past election that carries compiled results (≈195 today) so
      // the hero country filter is honest — a country's older results-bearing
      // election must still surface when a reader narrows to it, not fall
      // outside a short recency window. Grouped by year in the client.
      getRecentElectionsWithResults(400),
    ]);

    const [statsRow] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        upcoming: sql<number>`COUNT(*) FILTER (WHERE ${elections.electionDate} >= CURRENT_DATE)`,
        avgTurnout: sql<number>`ROUND((AVG(${elections.turnoutPercent}) FILTER (WHERE ${elections.turnoutPercent} IS NOT NULL))::numeric, 1)`,
        thisYear: sql<number>`COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM ${elections.electionDate}::date) = EXTRACT(YEAR FROM CURRENT_DATE))`,
        legislativeJur: sql<number>`COUNT(DISTINCT ${elections.jurisdictionId}) FILTER (WHERE LOWER(${elections.electionType}) = 'legislative')`,
        presidentialJur: sql<number>`COUNT(DISTINCT ${elections.jurisdictionId}) FILTER (WHERE LOWER(${elections.electionType}) = 'presidential')`,
        turnoutCount: sql<number>`COUNT(*) FILTER (WHERE ${elections.turnoutPercent} IS NOT NULL)`,
        estimatedJur: sql<number>`COUNT(DISTINCT ${elections.jurisdictionId}) FILTER (WHERE ${elections.dateConfidence} = 'estimated')`,
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

    const [ipuSource, wikidataSource, ideaSource] = await Promise.all([
      getSource("ipu_parline"),
      getSource("wikidata"),
      getSource("international_idea"),
    ]);

    coverage = {
      legislativeJurisdictions: Number(statsRow?.legislativeJur ?? 0),
      presidentialJurisdictions: Number(statsRow?.presidentialJur ?? 0),
      turnoutJurisdictions: Number(statsRow?.turnoutCount ?? 0),
      estimatedJurisdictions: Number(statsRow?.estimatedJur ?? 0),
      ipuRetrievedAt: ipuSource?.lastSyncAt ? ipuSource.lastSyncAt.toISOString() : null,
      wikidataRetrievedAt: wikidataSource?.lastSyncAt
        ? wikidataSource.lastSyncAt.toISOString()
        : null,
      ideaRetrievedAt: ideaSource?.lastSyncAt ? ideaSource.lastSyncAt.toISOString() : null,
    };
  } catch (err) {
    console.error("[elections] stats query failed:", err);
  }

  // The full-bleed engraving hero (with the country typeahead) lives inside
  // ElectionsClient so the hero search can drive the client-side filter.
  return (
    <ElectionsClient
      upcoming={upcoming}
      recent={recent}
      stats={stats}
      coverage={coverage}
    />
  );
}
