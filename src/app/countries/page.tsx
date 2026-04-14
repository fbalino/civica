import { getAllJurisdictions } from "@/lib/db/queries";
import { CountrySearch } from "./search";

export const metadata = {
  title: "Index — Civica",
  description: "Browse all countries and territories in the Civica atlas.",
};

function govColor(type: string | null): string {
  if (!type) return "var(--color-gov-other)";
  const map: Record<string, string> = {
    Presidential: "var(--color-gov-presidential)",
    Parliamentary: "var(--color-gov-parliamentary)",
    "Semi-presidential": "var(--color-gov-semi-presidential)",
    Theocratic: "var(--color-gov-theocratic)",
    Absolute: "var(--color-gov-absolute)",
    Federal: "var(--color-gov-parliamentary)",
    Communist: "#E44040",
    Constitutional: "var(--color-gov-parliamentary)",
  };
  const entry = Object.entries(map).find(([k]) => type.includes(k));
  return entry?.[1] ?? "var(--color-gov-other)";
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

  const continents = [...new Set(countries.map((c) => c.continent).filter(Boolean))].sort();

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "48px var(--spacing-page-x)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-44)",
          fontWeight: 400,
          letterSpacing: "var(--tracking-tight)",
          marginBottom: 8,
          color: "var(--color-text-primary)",
        }}
      >
        Index
      </h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-30)",
          marginBottom: 40,
        }}
      >
        {countries.length > 0
          ? `${countries.length} countries loaded \u00B7 Full coverage coming soon`
          : "Data not yet loaded. Run the seed scripts to populate."}
      </p>

      <CountrySearch defaultValue={searchQuery ?? ""} continent={continentFilter} />

      {continents.length > 0 && (
        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
          <a
            href="/countries"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              background: !continentFilter ? "var(--color-accent)" : "var(--color-card-bg)",
              color: !continentFilter ? "var(--color-bg)" : "var(--color-text-40)",
              border: continentFilter ? "1px solid var(--color-card-border)" : "none",
            }}
          >
            All
          </a>
          {continents.map((c) => (
            <a
              key={c}
              href={`/countries?continent=${encodeURIComponent(c!)}`}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-12)",
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                textDecoration: "none",
                background: continentFilter === c ? "var(--color-accent)" : "var(--color-card-bg)",
                color: continentFilter === c ? "var(--color-bg)" : "var(--color-text-40)",
                border: continentFilter !== c ? "1px solid var(--color-card-border)" : "none",
              }}
            >
              {c}
            </a>
          ))}
        </nav>
      )}

      {/* Table-style list — prototype: 1px gap grid, 5-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 1,
          background: "var(--color-grid-bg)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        {/* Column header */}
        <div
          className="hidden md:grid index-row"
          style={{
            background: "var(--color-card-bg)",
            padding: "10px 24px",
            cursor: "default",
          }}
        >
          <span />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-10)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--color-text-25)" }}>
            Country
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-10)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--color-text-25)" }}>
            Government
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-10)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--color-text-25)", textAlign: "right" }}>
            Population
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-10)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--color-text-25)", textAlign: "right" }}>
            Democracy
          </span>
        </div>
        {filtered.map((country) => (
          <a
            key={country.slug}
            href={`/countries/${country.slug}`}
            className="index-row"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span style={{ fontSize: "var(--text-32)", lineHeight: 1 }}>
              {countryFlag(country.iso2)}
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-18)",
                  fontWeight: 400,
                  color: "var(--color-text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {country.name}
              </span>
              <span
                className="hidden sm:inline"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-25)",
                }}
              >
                {country.capital}
              </span>
            </div>
            <span
              className="hidden md:inline"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-11)",
                color: govColor(country.governmentTypeDetail ?? country.governmentType),
              }}
            >
              {country.governmentTypeDetail ?? country.governmentType ?? ""}
            </span>
            <span
              className="hidden sm:inline"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-11)",
                color: "var(--color-text-40)",
                textAlign: "right",
              }}
            >
              {country.population ? formatPopulation(country.population) : ""}
            </span>
            <span
              className="hidden md:inline"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-11)",
                color: "var(--color-text-25)",
                textAlign: "right",
              }}
            >
              {country.democracyIndex?.toFixed(2) ?? ""}
            </span>
          </a>
        ))}
      </div>

      {filtered.length === 0 && countries.length > 0 && (
        <p
          style={{
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-40)",
            padding: "48px 0",
          }}
        >
          {searchQuery
            ? `No countries match "${resolvedParams?.q}".`
            : "No countries match the selected filter."}
        </p>
      )}
    </div>
  );
}
