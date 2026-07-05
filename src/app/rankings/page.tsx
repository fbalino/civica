import type { Metadata } from "next";
import { getRankingsMatrix } from "@/lib/db/queries";
import { RankingsMatrix } from "./RankingsMatrix";
import { withOg } from "@/lib/og";
import { HeroReveal, HeroRevealItem, Reveal } from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Country Rankings — Democracy, Freedom & Governance",
  description:
    "Sort 250+ countries across governance and development metrics — the Civica Index, democracy, freedom, rule of law, corruption control, GDP, population, HDI, life expectancy and more. Sourced from the Civica Index, Wikidata, the World Bank, and the archived CIA World Factbook.",
  alternates: { canonical: "https://civicaatlas.org/rankings" },
  openGraph: withOg({
    title: "Country Rankings — Democracy, Freedom & Governance · Civica Atlas",
    description:
      "Sort 250+ countries across the Civica Index, democracy, freedom, rule of law, GDP, population, HDI and more.",
    url: "https://civicaatlas.org/rankings",
  }),
};

export default async function RankingsPage() {
  let rows: Awaited<ReturnType<typeof getRankingsMatrix>> = [];
  try {
    rows = await getRankingsMatrix();
  } catch {
    // DB not yet seeded / unreachable — render the empty state below.
  }

  return (
    <>
      {/* Full-bleed engraving hero (homepage idiom). Rendered as a sibling
          before the page container — matching /compare — so the 100vw breakout
          reaches the viewport edges with no top-padding gap. Reuses the
          canonical .factbook-hero-* class family (eyebrow → title → dek). */}
      <section
        className="factbook-landing-hero"
        aria-labelledby="rankings-hero-title"
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
            Rankings
          </HeroRevealItem>
          <HeroRevealItem
            as="h1"
            id="rankings-hero-title"
            className="factbook-hero-title"
          >
            Countries ranked across every metric.
          </HeroRevealItem>
          <HeroRevealItem as="p" className="factbook-hero-dek">
            Sort 250+ countries by the Civica Index and its governance
            dimensions &mdash; democracy, freedom, rule of law, corruption
            control &mdash; alongside population, GDP, area, HDI, life
            expectancy and literacy. Every column traces to its source.
          </HeroRevealItem>
        </HeroReveal>
      </section>

      <div className="editorial-page editorial-page--full">
        {rows.length > 0 ? (
          <Reveal as="section" amount={0.1}>
            <RankingsMatrix rows={rows} />
          </Reveal>
        ) : (
          <p className="editorial-empty">
            No ranking data available. Run the seed scripts to populate.
          </p>
        )}
      </div>
    </>
  );
}
