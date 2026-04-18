import type { Metadata } from "next";
import { getAllJurisdictions } from "@/lib/db/queries";
import { CountrySearch } from "./search";
import { CountryFlag } from "@/components/CountryFlag";
import { classifyGovernment } from "@/lib/data/government-category";

export const metadata: Metadata = {
  title: "All Countries & Territories — Government Structure Index",
  description:
    "Browse all 250+ countries and territories. Filter by continent, government type, and political system. Complete index of world governance data.",
  alternates: { canonical: "https://civicaatlas.org/countries" },
  openGraph: {
    title: "All Countries & Territories — Government Structure Index | Civica",
    description:
      "Browse all 250+ countries and territories. Filter by continent, government type, and political system. Complete index of world governance data.",
    url: "https://civicaatlas.org/countries",
  },
};

function formatPopulation(pop: number | null): string {
  if (!pop) return "";
  if (pop >= 1_000_000_000) return `${(pop / 1_000_000_000).toFixed(2)}B`;
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`;
  return pop.toLocaleString();
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString();
}

const CONTINENT_ORDER = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

export default async function CountriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;

  let countries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    countries = await getAllJurisdictions();
  } catch {
    // DB not yet seeded
  }

  const continentFilter =
    typeof resolvedParams?.continent === "string"
      ? resolvedParams.continent
      : null;
  const searchQuery =
    typeof resolvedParams?.q === "string" ? resolvedParams.q.toLowerCase() : null;

  let filtered = continentFilter
    ? countries.filter((c) => c.continent === continentFilter)
    : countries;

  if (searchQuery) {
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery) ||
        c.capital?.toLowerCase().includes(searchQuery) ||
        c.continent?.toLowerCase().includes(searchQuery)
    );
  }

  const continents = [...new Set(countries.map((c) => c.continent).filter(Boolean))].sort(
    (a, b) => CONTINENT_ORDER.indexOf(a!) - CONTINENT_ORDER.indexOf(b!)
  );

  const totalPopulation = countries.reduce((sum, c) => sum + (c.population ?? 0), 0);

  const govTypeCounts = new Map<string, number>();
  for (const c of countries) {
    const cat = classifyGovernment(c.governmentTypeDetail ?? c.governmentType);
    govTypeCounts.set(cat.label, (govTypeCounts.get(cat.label) ?? 0) + 1);
  }

  const grouped = new Map<string, typeof filtered>();
  for (const c of filtered) {
    const cont = c.continent ?? "Other";
    if (!grouped.has(cont)) grouped.set(cont, []);
    grouped.get(cont)!.push(c);
  }

  const isSearching = !!searchQuery;
  const isFiltered = !!continentFilter || isSearching;

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "0 var(--spacing-page-x)",
      }}
    >
      {/* Hero */}
      <header className="index-hero">
        <h1 className="hero-heading" style={{ marginBottom: 12 }}>
          Countries &amp; Territories
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-18)",
            lineHeight: "var(--leading-relaxed)",
            color: "var(--color-text-40)",
            maxWidth: 640,
            margin: "0 0 32px",
          }}
        >
          A comprehensive index of sovereign states — their governments,
          populations, and political systems.
        </p>

        {/* Aggregate stats */}
        {countries.length > 0 && (
          <div className="index-stats-row">
            <div className="index-stat">
              <span className="index-stat__value">{countries.length}</span>
              <span className="index-stat__label">Countries</span>
            </div>
            <div className="index-stat-divider" />
            <div className="index-stat">
              <span className="index-stat__value">{continents.length}</span>
              <span className="index-stat__label">Continents</span>
            </div>
            <div className="index-stat-divider" />
            <div className="index-stat">
              <span className="index-stat__value">{formatLargeNumber(totalPopulation)}</span>
              <span className="index-stat__label">Total population</span>
            </div>
          </div>
        )}
      </header>

      {/* Search + continent filter */}
      <div className="index-controls">
        <CountrySearch defaultValue={searchQuery ?? ""} continent={continentFilter} />

        {continents.length > 0 && (
          <nav className="index-continent-nav">
            <a
              href="/countries"
              className={`index-continent-chip ${!continentFilter ? "index-continent-chip--active" : ""}`}
            >
              All
            </a>
            {continents.map((c) => (
              <a
                key={c}
                href={`/countries?continent=${encodeURIComponent(c!)}`}
                className={`index-continent-chip ${continentFilter === c ? "index-continent-chip--active" : ""}`}
              >
                {c}
              </a>
            ))}
          </nav>
        )}
      </div>

      {/* Country sections by continent */}
      {filtered.length > 0 && (
        <div className="index-sections">
          {(isFiltered
            ? [...grouped.entries()]
            : continents
                .filter((c) => grouped.has(c!))
                .map((c) => [c!, grouped.get(c!)!] as [string, typeof filtered])
          ).map(([continent, group]) => {
            const contPop = group.reduce((s, c) => s + (c.population ?? 0), 0);
            return (
              <section key={continent} className="index-continent-section">
                <div className="index-continent-header">
                  <h2 className="index-continent-title">{continent}</h2>
                  <div className="index-continent-meta">
                    <span>{group.length} {group.length === 1 ? "country" : "countries"}</span>
                    {contPop > 0 && (
                      <>
                        <span className="index-continent-meta-dot">&middot;</span>
                        <span>{formatLargeNumber(contPop)} people</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="index-card-grid">
                  {group.map((country) => {
                    const govCat = classifyGovernment(
                      country.governmentTypeDetail ?? country.governmentType
                    );
                    return (
                      <a
                        key={country.slug}
                        href={`/countries/${country.slug}`}
                        className="index-country-card cv-card cv-card--interactive"
                      >
                        <div className="index-card-top">
                          <CountryFlag iso2={country.iso2} size={36} />
                          <div className="index-card-name-block">
                            <span className="index-card-name">{country.name}</span>
                            {country.capital && (
                              <span className="index-card-capital">{country.capital}</span>
                            )}
                          </div>
                        </div>

                        <div className="index-card-bottom">
                          <span
                            className="gov-badge"
                            style={{
                              color: govCat.color,
                              background: `color-mix(in srgb, ${govCat.color} 12%, transparent)`,
                              border: `1px solid color-mix(in srgb, ${govCat.color} 25%, transparent)`,
                            }}
                          >
                            {govCat.label}
                          </span>
                          <div className="index-card-data">
                            {country.population ? (
                              <span className="index-card-datum">
                                {formatPopulation(country.population)}
                              </span>
                            ) : null}
                            {country.democracyIndex != null && (
                              <span className="index-card-datum index-card-datum--dim">
                                DI {country.democracyIndex.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && countries.length > 0 && (
        <div className="index-empty">
          <p>
            {searchQuery
              ? `No countries match "${resolvedParams?.q}".`
              : "No countries match the selected filter."}
          </p>
        </div>
      )}

      {countries.length === 0 && (
        <div className="index-empty">
          <p>Data not yet loaded. Run the seed scripts to populate.</p>
        </div>
      )}
    </div>
  );
}
