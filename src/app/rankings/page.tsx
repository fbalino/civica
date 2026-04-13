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
  return `${n.toLocaleString()} km²`;
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
    <div className="wide-container py-[var(--spacing-section)]">
      <h1 className="font-heading text-4xl font-normal tracking-tight mb-2">
        Rankings
      </h1>
      <p className="font-mono text-xs text-[var(--color-text-tertiary)] mb-10">
        Countries ranked by key indicators.
      </p>

      <nav className="flex gap-2 flex-wrap mb-8">
        {RANKING_METRICS.map((m) => (
          <a
            key={m.key}
            href={`/rankings?metric=${m.key}`}
            className={`font-mono text-xs px-3 py-1.5 rounded-[var(--radius-sm)] transition-colors no-underline ${
              m.key === metric.key
                ? "bg-[var(--color-accent)] text-[var(--color-text-inverse)]"
                : "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
            }`}
          >
            {m.title}
          </a>
        ))}
      </nav>

      {tableRows.length > 0 ? (
        <RankingTable title={metric.title} unit={metric.unit} rows={tableRows} pageSize={25} />
      ) : (
        <p className="text-center text-[var(--color-text-tertiary)] py-12">
          No ranking data available. Run the seed scripts to populate.
        </p>
      )}
    </div>
  );
}
