import type { Metadata } from "next";
import { rankCountriesByFact } from "@/lib/db/queries";
import { RankingTable } from "@/components/RankingTable";
import { withOg } from "@/lib/og";
import { HeroReveal, HeroRevealItem, Reveal } from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Country Rankings — Democracy, Freedom & Governance",
  description:
    "Rank 250+ countries by GDP, population, area, life expectancy, and democracy index. Sourced from Wikidata, the World Bank, and the archived CIA World Factbook.",
  alternates: { canonical: "https://civicaatlas.org/rankings" },
  openGraph: withOg({
    title: "Country Rankings — Democracy, Freedom & Governance · Civica Atlas",
    description:
      "Rank 250+ countries by GDP, population, area, life expectancy, and democracy index.",
    url: "https://civicaatlas.org/rankings",
  }),
};

const RANKING_METRICS = [
  { key: "population", title: "Population", unit: "people", format: formatPopulation },
  { key: "gdp_ppp", title: "GDP (PPP)", unit: "USD", format: formatGdp },
  { key: "gdp_per_capita_ppp", title: "GDP per Capita (PPP)", unit: "USD", format: formatGdpPerCapita },
  { key: "total_area", title: "Total Area", unit: "sq km", format: formatArea },
  { key: "life_expectancy", title: "Life Expectancy", unit: "years", format: formatDefault },
  { key: "literacy_rate", title: "Literacy Rate", unit: "%", format: formatDefault },
] as const;

function formatPopulation(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatGdp(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  return `$${n.toLocaleString()}`;
}

function formatGdpPerCapita(n: number): string {
  return `$${n.toLocaleString()}`;
}

function formatArea(n: number): string {
  return `${n.toLocaleString()} km\u00B2`;
}

function formatDefault(n: number): string {
  return n.toLocaleString();
}

function formatRetrievedAt(value: Date | string | null): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.toISOString();
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const metricKey =
    typeof resolvedParams?.metric === "string" ? resolvedParams.metric : "population";

  const metric =
    RANKING_METRICS.find((m) => m.key === metricKey) ?? RANKING_METRICS[0];

  let rows: Awaited<ReturnType<typeof rankCountriesByFact>> = [];
  try {
    rows = await rankCountriesByFact(metric.key, "desc", 50);
  } catch {
    // DB not yet seeded
  }

  const tableRows = rows.map((r, i) => ({
    rank: i + 1,
    name: r.jurisdiction.name,
    slug: r.jurisdiction.slug,
    value: r.fact.factValueNumeric
      ? metric.format(r.fact.factValueNumeric)
      : r.fact.factValue ?? "",
    numericValue: r.fact.factValueNumeric ?? undefined,
    iso2: r.jurisdiction.iso2 ?? undefined,
    source: r.fact.sourceId,
    retrievedAt: formatRetrievedAt(r.fact.retrievedAt ?? r.fact.asOf),
  }));

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
            Countries ranked by key indicators.
          </HeroRevealItem>
          <HeroRevealItem as="p" className="factbook-hero-dek">
            Global rankings for 250+ countries by population, GDP, area, life
            expectancy, and literacy &mdash; drawn from Wikidata, the World
            Bank, and the archived CIA World Factbook.
          </HeroRevealItem>
        </HeroReveal>
      </section>

      <div className="editorial-page editorial-page--full">
      <Reveal as="nav" amount={0.4} style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-8)" }}>
        {RANKING_METRICS.map((m) => (
          <a
            key={m.key}
            href={`/rankings?metric=${m.key}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-13)",
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              background: m.key === metric.key ? "var(--color-accent)" : "var(--color-card-bg)",
              color: m.key === metric.key ? "var(--color-bg)" : "var(--color-text-40)",
              border: m.key !== metric.key ? "1px solid var(--color-card-border)" : "none",
            }}
          >
            {m.title}
          </a>
        ))}
      </Reveal>

      {tableRows.length > 0 ? (
        <Reveal as="section" amount={0.15}>
          <RankingTable title={metric.title} unit={metric.unit} rows={tableRows} pageSize={25} />
        </Reveal>
      ) : (
        <p
          style={{
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-15)",
            color: "var(--color-text-40)",
            padding: "48px 0",
          }}
        >
          No ranking data available. Run the seed scripts to populate.
        </p>
      )}
      </div>
    </>
  );
}
