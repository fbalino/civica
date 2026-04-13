import { StatCard } from "@/components/StatCard";
import { SourceDot } from "@/components/SourceDot";

const FEATURED_COUNTRIES = [
  { name: "United States", slug: "united-states", continent: "North America", code: "US" },
  { name: "United Kingdom", slug: "united-kingdom", continent: "Europe", code: "GB" },
  { name: "France", slug: "france", continent: "Europe", code: "FR" },
  { name: "Germany", slug: "germany", continent: "Europe", code: "DE" },
  { name: "Brazil", slug: "brazil", continent: "South America", code: "BR" },
  { name: "India", slug: "india", continent: "Asia", code: "IN" },
  { name: "Japan", slug: "japan", continent: "Asia", code: "JP" },
  { name: "China", slug: "china", continent: "Asia", code: "CN" },
  { name: "South Africa", slug: "south-africa", continent: "Africa", code: "ZA" },
  { name: "Australia", slug: "australia", continent: "Oceania", code: "AU" },
  { name: "Mexico", slug: "mexico", continent: "North America", code: "MX" },
  { name: "Canada", slug: "canada", continent: "North America", code: "CA" },
  { name: "Switzerland", slug: "switzerland", continent: "Europe", code: "CH" },
  { name: "South Korea", slug: "south-korea", continent: "Asia", code: "KR" },
  { name: "Nigeria", slug: "nigeria", continent: "Africa", code: "NG" },
  { name: "Russia", slug: "russia", continent: "Europe", code: "RU" },
  { name: "Iran", slug: "iran", continent: "Asia", code: "IR" },
  { name: "Saudi Arabia", slug: "saudi-arabia", continent: "Asia", code: "SA" },
  { name: "Uruguay", slug: "uruguay", continent: "South America", code: "UY" },
  { name: "European Union", slug: "european-union", continent: "Supranational", code: "EU" },
];

function countryFlag(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="hero-gradient border-b border-[var(--color-border)]">
        <div className="editorial-container py-20 md:py-28">
          <hr className="editorial-rule--accent mb-8" />
          <h1 className="font-heading text-4xl md:text-5xl font-light tracking-tight text-[var(--color-text-primary)] max-w-2xl leading-tight">
            The world&rsquo;s governments,
            <br />
            <span className="italic">visualized.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[var(--color-text-secondary)] max-w-xl">
            An interactive atlas of government structures, political systems,
            and country data for every nation &mdash; from constitutions to
            legislatures to heads of state.
          </p>
          <div className="mt-5 flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
            <span>Sources include Wikidata</span>
            <SourceDot source="wikidata" retrievedAt="2026-04-13" />
            <span className="mx-1">&middot;</span>
            <span>CIA World Factbook</span>
            <SourceDot source="cia_factbook" retrievedAt="2026-01-23" />
          </div>
          <a
            href="/countries"
            className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)] transition-colors no-underline"
          >
            Explore all countries
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </section>

      {/* Key stats */}
      <section className="wide-container py-[var(--spacing-section)]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Countries" value="260+" source="cia_factbook" retrievedAt="2026-01-23" />
          <StatCard label="Government Types" value="12" source="wikidata" retrievedAt="2026-04-13" />
          <StatCard label="Legislatures" value="190+" source="ipu_parline" retrievedAt="2026-03-15" />
          <StatCard label="Constitutions" value="204" source="constitute_project" retrievedAt="2026-02-01" />
        </div>
      </section>

      {/* Country grid */}
      <section className="wide-container pb-[var(--spacing-section)]">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="font-heading text-2xl font-medium tracking-tight">
            Explore Countries
          </h2>
          <a
            href="/countries"
            className="text-sm text-[var(--color-accent-text)] hover:text-[var(--color-accent-hover)] transition-colors no-underline"
          >
            View all &rarr;
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {FEATURED_COUNTRIES.map((country) => (
            <a
              key={country.slug}
              href={`/countries/${country.slug}`}
              className="card-hover group flex items-center gap-3 p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] transition-all no-underline"
            >
              <span className="flag-emoji" role="img" aria-label={`${country.name} flag`}>
                {countryFlag(country.code)}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-text)] transition-colors truncate">
                  {country.name}
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {country.continent}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Data provenance — integrated, not documentation-style */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface-alt)]">
        <div className="editorial-container py-12">
          <div className="flex flex-col sm:flex-row gap-8 sm:gap-12">
            <div className="flex-1">
              <h3 className="font-heading text-lg font-medium tracking-tight mb-3">
                Data Provenance
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Every data point on Civica carries a provenance indicator
                showing its source and freshness. Hover any dot to see details.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:pt-1">
              <div className="flex items-center gap-3">
                <span className="source-dot source-dot--live" data-source="" data-date="" />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Live or regularly updated
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="source-dot source-dot--frozen" data-source="" data-date="" />
                <span className="text-sm text-[var(--color-text-secondary)]">
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
