import type { Metadata } from "next";
import { getUpcomingElections, getRecentElectionsWithResults } from "@/lib/db/queries";
import { db } from "@/lib/db/index";
import { elections, jurisdictions } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import ElectionsClient from "./ElectionsClient";
import { withOg } from "@/lib/og";
import { HeroReveal, HeroRevealItem } from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Elections Around the World — Calendar & Results",
  description:
    "Track upcoming and past elections worldwide: voter turnout, party-colored results, electoral system labels, and historical timelines for a growing set of countries.",
  alternates: { canonical: "https://civicaatlas.org/elections" },
  openGraph: withOg({
    title: "Elections Around the World — Calendar & Results · Civica Atlas",
    description:
      "Track upcoming and past elections worldwide, with turnout visualization and party-colored results.",
    url: "https://civicaatlas.org/elections",
  }),
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
        avgTurnout: sql<number>`ROUND((AVG(${elections.turnoutPercent}) FILTER (WHERE ${elections.turnoutPercent} IS NOT NULL))::numeric, 1)`,
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
  } catch (err) {
    console.error("[elections] stats query failed:", err);
  }

  return (
    <>
      {/* Full-bleed engraving hero (homepage idiom). Rendered as a sibling
          before <ElectionsClient> — matching /compare — so the 100vw breakout
          reaches the viewport edges with no top-padding gap. The stat row and
          region chips stay beneath the hero, inside the client component. */}
      <section
        className="factbook-landing-hero"
        aria-labelledby="elections-hero-title"
      >
        <ParallaxImage
          className="factbook-hero-art"
          src="/engravings/hero.webp"
          darkSrc="/engravings/hero-dark.webp"
          alt=""
          aria-hidden="true"
        />
        <div className="factbook-hero-scrim" aria-hidden="true" />
        <HeroReveal className="factbook-hero-inner">
          <HeroRevealItem className="factbook-hero-eyebrow">
            Elections
          </HeroRevealItem>
          <HeroRevealItem
            as="h1"
            id="elections-hero-title"
            className="factbook-hero-title"
          >
            Elections, tracked worldwide.
          </HeroRevealItem>
          <HeroRevealItem as="p" className="factbook-hero-dek">
            Upcoming and past elections, with voter turnout from IDEA and
            party-colored results from Wikidata and official sources.
          </HeroRevealItem>
        </HeroReveal>
      </section>

      <ElectionsClient upcoming={upcoming} recent={recent} stats={stats} />
    </>
  );
}
