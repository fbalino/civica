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
  title: "Country Rankings — Population, Development & Reference Facts",
  description:
    "Sort countries across source-reported population, GDP, area, human development, life expectancy, literacy, and age measures, with source and freshness context.",
  alternates: { canonical: "https://civicaatlas.org/rankings" },
  openGraph: withOg({
    title: "Country Rankings — Population, Development & Reference Facts · Civica Atlas",
    description:
      "Sort countries across population, GDP, area, human development, life expectancy, literacy, and age measures.",
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
        title="Countries ordered by source-reported reference measures."
        description={
          <>
            Sort{" "}
            {rows.length > 0
              ? `${rows.length} jurisdictions`
              : "available jurisdictions"}{" "}
            by population, GDP, area, HDI, life expectancy, literacy, and
            median age. Governance assessments remain separate on the{" "}
            <Link href="/governance-evidence">Governance Evidence Dashboard</Link>.
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
