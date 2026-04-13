import { getAllJurisdictions } from "@/lib/db/queries";
import { CountrySearch } from "./search";

export const metadata = {
  title: "Countries — Civica",
  description: "Browse all countries and territories in the Civica atlas.",
};

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
    <div className="wide-container py-[var(--spacing-section)]">
      <h1 className="font-heading text-4xl font-normal tracking-tight mb-2">
        Countries
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-6">
        {countries.length > 0
          ? `${countries.length} sovereign states and territories`
          : "Data not yet loaded. Run the seed scripts to populate."}
      </p>

      <CountrySearch defaultValue={searchQuery ?? ""} continent={continentFilter} />

      {continents.length > 0 && (
        <nav className="flex gap-2 flex-wrap mb-8">
          <a
            href="/countries"
            className={`px-3 py-1.5 text-sm rounded-[var(--radius-md)] transition-colors no-underline ${
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
              className={`px-3 py-1.5 text-sm rounded-[var(--radius-md)] transition-colors no-underline ${
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((country) => (
          <a
            key={country.slug}
            href={`/countries/${country.slug}`}
            className="card-hover group flex flex-col gap-2 p-5 rounded-[var(--radius-lg)] border border-[var(--color-border-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] transition-all no-underline"
          >
            <div className="flex items-center gap-3">
              {country.flagUrl && (
                <img
                  src={country.flagUrl}
                  alt=""
                  className="w-8 h-5.5 object-cover rounded-sm shadow-sm"
                />
              )}
              <span className="font-heading text-lg font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-text)] transition-colors">
                {country.name}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-[var(--color-text-tertiary)]">
              {country.continent && <span>{country.continent}</span>}
              {country.population && country.population > 0 && (
                <span>Pop: {(country.population / 1e6).toFixed(1)}M</span>
              )}
            </div>
            {country.governmentTypeDetail && (
              <span className="text-xs text-[var(--color-text-secondary)] capitalize">
                {country.governmentTypeDetail}
              </span>
            )}
          </a>
        ))}
      </div>

      {filtered.length === 0 && countries.length > 0 && (
        <p className="text-center text-[var(--color-text-tertiary)] py-12">
          {searchQuery
            ? `No countries match "${resolvedParams?.q}".`
            : "No countries match the selected filter."}
        </p>
      )}
    </div>
  );
}
