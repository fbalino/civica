import { getAllJurisdictions } from "@/lib/db/queries";

const GOV_TYPE_COLORS: Record<string, string> = {
  Presidential: "#D4764E",
  Parliamentary: "#4E8BD4",
  "Semi-presidential": "#9B6DC6",
  Theocratic: "#5CAA6E",
  Absolute: "#C4A44E",
  Federal: "#4E8BD4",
  Communist: "#E44040",
  Constitutional: "#4E8BD4",
};

function govColor(type: string | null): string {
  if (!type) return "#8899AA";
  const entry = Object.entries(GOV_TYPE_COLORS).find(([k]) => type.includes(k));
  return entry?.[1] ?? "#8899AA";
}

function govLabel(type: string | null): string {
  if (!type) return "Other";
  return type.split(" ")[0];
}

function countryFlag(iso2: string | null): string {
  if (!iso2) return "";
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function formatPopulation(pop: number | null): string {
  if (!pop) return "";
  if (pop >= 1_000_000_000) return `${(pop / 1_000_000_000).toFixed(2)}B`;
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`;
  return pop.toLocaleString();
}

export default async function Home() {
  let countries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    countries = await getAllJurisdictions();
  } catch {
    // DB not yet seeded
  }

  const featured = countries.slice(0, 21);

  return (
    <div>
      {/* Hero */}
      <section className="wide-container pt-24 pb-14 md:pt-28 md:pb-16">
        <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-[var(--color-accent)] mb-6">
          {countries.length > 0 ? `${countries.length}+ countries` : "260+ countries"} · Live data · Open source
        </p>
        <h1 className="font-heading text-5xl md:text-[64px] font-normal leading-[1.05] tracking-tight text-[var(--color-text-primary)] mb-6 max-w-2xl">
          How the world<br />is <em>governed</em>
        </h1>
        <p className="font-mono text-sm text-[var(--color-text-tertiary)] leading-relaxed max-w-lg mb-12">
          Interactive government structure diagrams, legislature visualizations,
          constitutional texts, and country intelligence. The successor to the CIA World Factbook.
        </p>

        {/* Country grid */}
        {featured.length > 0 && (
          <div className="country-grid">
            {featured.map((co) => {
              const color = govColor(co.governmentTypeDetail ?? co.governmentType);
              return (
                <a
                  key={co.slug}
                  href={`/countries/${co.slug}`}
                  className="country-grid-cell no-underline group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[32px] leading-none">
                      {countryFlag(co.iso2)}
                    </span>
                    <span
                      className="gov-badge"
                      style={{
                        color,
                        border: `1px solid ${color}33`,
                      }}
                    >
                      {govLabel(co.governmentTypeDetail ?? co.governmentType)}
                    </span>
                  </div>
                  <h3 className="font-heading text-[22px] font-normal tracking-tight text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-text)] transition-colors mb-1 leading-tight">
                    {co.name}
                  </h3>
                  <p className="font-mono text-[11px] text-[var(--color-text-tertiary)] m-0">
                    {co.capital}
                    {co.capital && co.population ? " · " : ""}
                    {co.population ? formatPopulation(co.population) : ""}
                  </p>
                </a>
              );
            })}
          </div>
        )}

        {featured.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-mono text-sm text-[var(--color-text-tertiary)]">
              Run the seed scripts to populate country data.
            </p>
            <a
              href="/countries"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 text-sm font-mono rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-colors no-underline"
            >
              Explore countries &rarr;
            </a>
          </div>
        )}
      </section>

      {/* Government types legend */}
      <section className="wide-container pt-14 pb-20">
        <h2 className="font-mono text-[13px] tracking-[0.15em] uppercase text-[var(--color-text-tertiary)] mb-8">
          Government types
        </h2>
        <div className="flex flex-wrap gap-6">
          {Object.entries(GOV_TYPE_COLORS).slice(0, 5).map(([type, color]) => (
            <div key={type} className="flex-1 min-w-[100px]">
              <div
                className="w-8 h-[3px] rounded-sm mb-3"
                style={{ background: color }}
              />
              <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                {type}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Data provenance */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface-alt)]">
        <div className="wide-container py-10">
          <div className="flex flex-col sm:flex-row gap-8 sm:gap-12">
            <div className="flex-1">
              <h3 className="font-heading text-lg tracking-tight mb-3">
                Data Provenance
              </h3>
              <p className="font-mono text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Every data point carries a provenance indicator. Hover any dot to see source and freshness.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:pt-1">
              <div className="flex items-center gap-3">
                <span className="source-dot source-dot--live" data-source="" data-date="" />
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  Live or regularly updated
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="source-dot source-dot--frozen" data-source="" data-date="" />
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  Frozen archive (Jan 2026)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
