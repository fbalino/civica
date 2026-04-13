import { getAllJurisdictions } from "@/lib/db/queries";
import { CountrySearch } from "./search";

export const metadata = {
  title: "Index — Civica",
  description: "Browse all countries and territories in the Civica atlas.",
};

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
    <div className="wide-container py-12 md:py-16">
      <h1 className="font-heading text-[44px] font-normal tracking-tight mb-2">
        Index
      </h1>
      <p className="font-mono text-xs text-[var(--color-text-tertiary)] mb-10">
        {countries.length > 0
          ? `${countries.length} countries loaded · Full coverage coming soon`
          : "Data not yet loaded. Run the seed scripts to populate."}
      </p>

      <CountrySearch defaultValue={searchQuery ?? ""} continent={continentFilter} />

      {continents.length > 0 && (
        <nav className="flex gap-2 flex-wrap mb-8">
          <a
            href="/countries"
            className={`font-mono text-xs px-3 py-1.5 rounded-[var(--radius-sm)] transition-colors no-underline ${
              !continentFilter
                ? "bg-[var(--color-accent)] text-[var(--color-text-inverse)]"
                : "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
            }`}
          >
            All
          </a>
          {continents.map((c) => (
            <a
              key={c}
              href={`/countries?continent=${encodeURIComponent(c!)}`}
              className={`font-mono text-xs px-3 py-1.5 rounded-[var(--radius-sm)] transition-colors no-underline ${
                continentFilter === c
                  ? "bg-[var(--color-accent)] text-[var(--color-text-inverse)]"
                  : "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
              }`}
            >
              {c}
            </a>
          ))}
        </nav>
      )}

      {/* Table-style list */}
      <div className="rounded-[var(--radius-sm)] overflow-hidden" style={{ background: "var(--color-border)" }}>
        <div className="flex flex-col gap-px">
          {/* Column header */}
          <div
            className="bg-[var(--color-surface-alt)] hidden md:grid items-center gap-4 px-6 py-2.5"
            style={{ gridTemplateColumns: "48px 1fr 180px 120px 80px" }}
          >
            <span />
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-tertiary)]">Country</span>
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-tertiary)]">Government</span>
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-tertiary)] text-right">Population</span>
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-tertiary)] text-right">Democracy</span>
          </div>
          {filtered.map((country) => (
            <a
              key={country.slug}
              href={`/countries/${country.slug}`}
              className="bg-[var(--color-surface)] hover:bg-[var(--color-surface-alt)] transition-colors no-underline grid items-center gap-4 px-6 py-4"
              style={{
                gridTemplateColumns: "48px 1fr 180px 120px 80px",
              }}
            >
              <span className="text-[28px] leading-none">
                {countryFlag(country.iso2)}
              </span>
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="font-heading text-lg font-normal text-[var(--color-text-primary)] truncate">
                  {country.name}
                </span>
                <span className="font-mono text-[11px] text-[var(--color-text-tertiary)] hidden sm:inline">
                  {country.capital}
                </span>
              </div>
              <span
                className="font-mono text-[11px] hidden md:inline"
                style={{ color: govColor(country.governmentTypeDetail ?? country.governmentType) }}
              >
                {country.governmentTypeDetail ?? country.governmentType ?? ""}
              </span>
              <span className="font-mono text-[11px] text-[var(--color-text-secondary)] text-right hidden sm:inline">
                {country.population ? formatPopulation(country.population) : ""}
              </span>
              <span className="font-mono text-[11px] text-[var(--color-text-tertiary)] text-right hidden md:inline">
                {country.democracyIndex?.toFixed(2) ?? ""}
              </span>
            </a>
          ))}
        </div>
      </div>

      {filtered.length === 0 && countries.length > 0 && (
        <p className="text-center font-mono text-sm text-[var(--color-text-tertiary)] py-12">
          {searchQuery
            ? `No countries match "${resolvedParams?.q}".`
            : "No countries match the selected filter."}
        </p>
      )}
    </div>
  );
}
