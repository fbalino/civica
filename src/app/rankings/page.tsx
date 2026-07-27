import type { Metadata } from "next";
import Link from "next/link";
import { getRankingsMatrix } from "@/lib/db/queries";
import { RankingsMatrix } from "./RankingsMatrix";
import { withOg } from "@/lib/og";
import { Reveal } from "@/components/motion/Reveal";
import { PageHero } from "@/components/PageHero";
import { Banner } from "@/components/editorial/Banner";
import {
  atlasSurfaceQueryValue,
  captureAtlasSurfaceQuery,
} from "@/lib/atlas/surface-query-state";

export const revalidate = 0;

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
  const rankingsResult = await captureAtlasSurfaceQuery(getRankingsMatrix);
  const rows = atlasSurfaceQueryValue(rankingsResult) ?? [];

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
          Each column orders countries by one named source, shown under its
          header — ranking is only meaningful within a single publisher&rsquo;s
          methodology, so this table never mixes publishers inside a column
          without flagging it. Reconciliation across sources happens on{" "}
          <Link href="/country/methodology/reconciliation">country pages</Link>
          , not here. Each populated metric cell carries a source/freshness
          dot. Rights vary by publisher; consult{" "}
          <Link href="/licensing#reuse">Licensing</Link> before reuse. The{" "}
          <Link href="/methodology/approach#reader-pages">
            provenance coverage audit
          </Link>{" "}
          explains how this table compares with compact surfaces that do not
          yet provide the same linkage.
        </Banner>
        {rankingsResult.status === "unavailable" ? (
          <Banner variant="warn">
            Ranking data is temporarily unavailable. Civica is not treating
            this as evidence that no source-reported reference measures exist.
          </Banner>
        ) : rows.length > 0 ? (
          <Reveal as="section" amount={0.1}>
            <RankingsMatrix rows={rows} />
          </Reveal>
        ) : (
          <p className="editorial-empty">
            No source-reported ranking rows are currently compiled. This is a
            coverage state, not a claim that the underlying measures do not
            exist.
          </p>
        )}
      </div>
    </>
  );
}
