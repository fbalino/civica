import type { Metadata } from "next";
import Link from "next/link";
import { getRankingsMatrix } from "@/lib/db/queries";
import { RankingsMatrix } from "./RankingsMatrix";
import { withOg } from "@/lib/og";
import { Reveal } from "@/components/motion/Reveal";
import { PageHero } from "@/components/PageHero";
import { Banner } from "@/components/editorial/Banner";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Country Rankings — Democracy, Freedom & Governance",
  description:
    "Sort countries across governance and development metrics — the research-beta Civica Index, democracy, freedom, rule of law, corruption control, GDP, population, HDI, life expectancy and more. Sourced from the Civica Index, Wikidata, the World Bank, and the archived CIA World Factbook.",
  alternates: { canonical: "https://civicaatlas.org/rankings" },
  openGraph: withOg({
    title: "Country Rankings — Democracy, Freedom & Governance · Civica Atlas",
    description:
      "Sort countries across the research-beta Civica Index, democracy, freedom, rule of law, GDP, population, HDI and more.",
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
      {/* Canonical full-bleed page hero (shared PageHero shell). */}
      <PageHero
        eyebrow="Rankings"
        titleId="rankings-hero-title"
        title="Countries ranked across governance and development metrics."
        description={
          <>
            Sort{" "}
            {rows.length > 0
              ? `${rows.length} jurisdictions`
              : "available jurisdictions"}{" "}
            by the Civica Index and its governance dimensions &mdash;
            democracy, freedom, rule of law, corruption control &mdash;
            alongside population, GDP, area, HDI, life expectancy and literacy.
            Metric cells carry source and freshness indicators; reuse terms
            remain source-specific.
          </>
        }
        engraving={{
          src: "/engravings/hero.webp",
          darkSrc: "/engravings/hero-dark.webp",
        }}
      />

      <div className="editorial-page editorial-page--full">
        {/* PROVENANCE_COVERAGE: rankings.metric-cell */}
        <Banner variant="info">
          Each populated metric cell carries a source/freshness dot. Rights
          vary by publisher; consult{" "}
          <Link href="/licensing#reuse">Licensing</Link> before reuse. The{" "}
          <Link href="/methodology/approach#reader-pages">
            provenance coverage audit
          </Link>{" "}
          explains how this table compares with compact surfaces that do not
          yet provide the same linkage.
        </Banner>
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
