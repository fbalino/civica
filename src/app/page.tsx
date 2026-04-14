import { getAllJurisdictions } from "@/lib/db/queries";
import { CountryFlag } from "@/components/CountryFlag";

const GOV_TYPE_COLORS: Record<string, string> = {
  Presidential: "var(--color-gov-presidential)",
  Parliamentary: "var(--color-gov-parliamentary)",
  "Semi-presidential": "var(--color-gov-semi-presidential)",
  Theocratic: "var(--color-gov-theocratic)",
  Absolute: "var(--color-gov-absolute)",
  Federal: "var(--color-gov-parliamentary)",
  Communist: "#E44040",
  Constitutional: "var(--color-gov-parliamentary)",
};

const GOV_TYPE_LEGEND: [string, string][] = [
  ["Presidential", "var(--color-gov-presidential)"],
  ["Parliamentary", "var(--color-gov-parliamentary)"],
  ["Semi-presidential", "var(--color-gov-semi-presidential)"],
  ["Theocratic", "var(--color-gov-theocratic)"],
  ["Absolute", "var(--color-gov-absolute)"],
];

function govColor(type: string | null): string {
  if (!type) return "var(--color-gov-other)";
  const entry = Object.entries(GOV_TYPE_COLORS).find(([k]) => type.includes(k));
  return entry?.[1] ?? "var(--color-gov-other)";
}

function govLabel(type: string | null): string {
  if (!type) return "Other";
  return type.split(" ")[0];
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
      {/* Hero — prototype: 100px top, 40px sides, 60px bottom */}
      <section
        style={{
          maxWidth: "var(--max-w-content)",
          margin: "0 auto",
          padding: "100px var(--spacing-page-x) 60px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-11)",
            letterSpacing: "var(--tracking-widest)",
            textTransform: "uppercase",
            color: "var(--color-accent)",
            marginBottom: 24,
          }}
        >
          {countries.length > 0 ? `${countries.length}+ countries` : "260+ countries"} &middot; Live data &middot; Open source
        </p>
        <h1 className="hero-heading">
          How the world<br />is <em>governed</em>
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-40)",
            lineHeight: "var(--leading-loose)",
            maxWidth: 520,
            marginBottom: 48,
          }}
        >
          Interactive government structure diagrams, legislature visualizations,
          constitutional texts, and country intelligence. The successor to the CIA World Factbook.
        </p>

        {/* Country grid — prototype: 3-col, 1px gap, rounded */}
        {featured.length > 0 && (
          <>
            <div className="country-grid">
              {featured.map((co) => {
                const color = govColor(co.governmentTypeDetail ?? co.governmentType);
                return (
                  <a
                    key={co.slug}
                    href={`/countries/${co.slug}`}
                    className="country-grid-cell"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <CountryFlag iso2={co.iso2} size={32} />
                      <span
                        className="gov-badge"
                        style={{ color, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)` }}
                      >
                        {govLabel(co.governmentTypeDetail ?? co.governmentType)}
                      </span>
                    </div>
                    <h3
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "var(--text-22)",
                        fontWeight: 400,
                        letterSpacing: "var(--tracking-snug)",
                        margin: "0 0 4px",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {co.name}
                    </h3>
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-11)",
                        color: "var(--color-text-30)",
                        margin: 0,
                      }}
                    >
                      {co.capital}
                      {co.capital && co.population ? " \u00B7 " : ""}
                      {co.population ? formatPopulation(co.population) : ""}
                    </p>
                  </a>
                );
              })}
            </div>
            {countries.length > featured.length && (
              <div style={{ marginTop: 32, textAlign: "center" }}>
                <a
                  href="/countries"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-accent)",
                    textDecoration: "none",
                  }}
                >
                  Browse all {countries.length} countries &rarr;
                </a>
              </div>
            )}
          </>
        )}

        {featured.length === 0 && (
          <div style={{ padding: "64px 0", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-14)", color: "var(--color-text-40)" }}>
              Run the seed scripts to populate country data.
            </p>
          </div>
        )}
      </section>

      {/* Government types legend — prototype: flex row with color bars */}
      <section
        style={{
          maxWidth: "var(--max-w-content)",
          margin: "0 auto",
          padding: "60px var(--spacing-page-x) 80px",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-13)",
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
            color: "var(--color-text-30)",
            marginBottom: 32,
          }}
        >
          Government types
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          {GOV_TYPE_LEGEND.map(([type, color]) => (
            <div key={type} style={{ flex: "1 1 100px" }}>
              <div className="gov-color-bar" style={{ background: color }} />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-50)",
                }}
              >
                {type}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Browse by continent */}
      {countries.length > 0 && (() => {
        const continentCounts = new Map<string, number>();
        countries.forEach((c) => {
          if (c.continent) continentCounts.set(c.continent, (continentCounts.get(c.continent) ?? 0) + 1);
        });
        const continents = [...continentCounts.entries()].sort((a, b) => b[1] - a[1]);
        if (continents.length === 0) return null;
        return (
          <section
            style={{
              maxWidth: "var(--max-w-content)",
              margin: "0 auto",
              padding: "0 var(--spacing-page-x) 80px",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-13)",
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                color: "var(--color-text-30)",
                marginBottom: 24,
              }}
            >
              Browse by continent
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 1, background: "var(--color-grid-bg)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
              {continents.map(([name, count]) => (
                <a
                  key={name}
                  href={`/countries?continent=${encodeURIComponent(name)}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    background: "var(--color-grid-cell)",
                    padding: "20px 24px",
                    transition: "background-color 0.15s ease",
                  }}
                  className="country-grid-cell"
                >
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "var(--text-18)",
                      color: "var(--color-text-primary)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-11)",
                      color: "var(--color-text-30)",
                    }}
                  >
                    {count} {count === 1 ? "country" : "countries"}
                  </span>
                </a>
              ))}
            </div>
          </section>
        );
      })()}
    </div>
  );
}
