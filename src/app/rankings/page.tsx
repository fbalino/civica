import { rankCountriesByFact } from "@/lib/db/queries";
import { RankingTable } from "@/components/RankingTable";

export const metadata = {
  title: "Rankings — Civica",
  description: "Compare countries by population, GDP, area, and more.",
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
    flagUrl: r.jurisdiction.flagUrl ?? undefined,
    source: "cia_factbook",
    retrievedAt: "2026-01-23",
  }));

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "60px var(--spacing-page-x)",
      }}
    >
      <h1 className="page-heading">
        Rankings
      </h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-30)",
          marginBottom: 40,
        }}
      >
        Countries ranked by key indicators.
      </p>

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
        {RANKING_METRICS.map((m) => (
          <a
            key={m.key}
            href={`/rankings?metric=${m.key}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
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
      </nav>

      {tableRows.length > 0 ? (
        <RankingTable title={metric.title} unit={metric.unit} rows={tableRows} pageSize={25} />
      ) : (
        <p
          style={{
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-40)",
            padding: "48px 0",
          }}
        >
          No ranking data available. Run the seed scripts to populate.
        </p>
      )}
    </div>
  );
}
