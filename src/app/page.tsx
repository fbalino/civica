import { StatCard } from "@/components/StatCard";
import { SourceDot } from "@/components/SourceDot";

const FEATURED_COUNTRIES = [
  { name: "United States", slug: "united-states", continent: "North America" },
  { name: "United Kingdom", slug: "united-kingdom", continent: "Europe" },
  { name: "France", slug: "france", continent: "Europe" },
  { name: "Germany", slug: "germany", continent: "Europe" },
  { name: "Brazil", slug: "brazil", continent: "South America" },
  { name: "India", slug: "india", continent: "Asia" },
  { name: "Japan", slug: "japan", continent: "Asia" },
  { name: "China", slug: "china", continent: "Asia" },
  { name: "South Africa", slug: "south-africa", continent: "Africa" },
  { name: "Australia", slug: "australia", continent: "Oceania" },
  { name: "Mexico", slug: "mexico", continent: "North America" },
  { name: "Canada", slug: "canada", continent: "North America" },
  { name: "Switzerland", slug: "switzerland", continent: "Europe" },
  { name: "South Korea", slug: "south-korea", continent: "Asia" },
  { name: "Nigeria", slug: "nigeria", continent: "Africa" },
  { name: "Russia", slug: "russia", continent: "Europe" },
  { name: "Iran", slug: "iran", continent: "Asia" },
  { name: "Saudi Arabia", slug: "saudi-arabia", continent: "Asia" },
  { name: "Uruguay", slug: "uruguay", continent: "South America" },
  { name: "European Union", slug: "european-union", continent: "Supranational" },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="w-full bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
        <div className="editorial-container py-16 md:py-24">
          <h1 className="font-heading text-4xl md:text-5xl font-light tracking-tight text-[var(--color-text-primary)] max-w-2xl">
            The world&rsquo;s governments,
            <br />
            <span className="italic">visualized.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-[var(--color-text-secondary)] max-w-xl">
            An interactive atlas of government structures, political systems,
            and country data for every nation &mdash; from constitutions to
            legislatures to heads of state.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
            <span>Sources include Wikidata</span>
            <SourceDot source="wikidata" retrievedAt="2026-04-13" />
            <span>and CIA World Factbook</span>
            <SourceDot source="cia_factbook" retrievedAt="2026-01-23" />
          </div>
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
        <h2 className="font-heading text-2xl font-medium tracking-tight mb-8">
          Explore Countries
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {FEATURED_COUNTRIES.map((country) => (
            <a
              key={country.slug}
              href={`/countries/${country.slug}`}
              className="group flex items-center gap-3 p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] transition-all no-underline"
            >
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

      {/* Design system legend */}
      <section className="editorial-container pb-[var(--spacing-section)]">
        <h3 className="font-heading text-xl font-medium tracking-tight mb-4">
          Data Provenance
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">
          Every data point on Civica carries a provenance indicator showing its
          source and freshness.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="source-dot source-dot--live" data-source="" data-date="" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Green dot &mdash; live or regularly updated source
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="source-dot source-dot--frozen" data-source="" data-date="" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Amber dot &mdash; frozen archive (CIA World Factbook, January 2026)
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
