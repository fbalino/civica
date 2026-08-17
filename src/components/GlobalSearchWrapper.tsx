import directory from "@/lib/jurisdictions/directory.generated.json";
import { GlobalSearch } from "./GlobalSearch";

// The header search is mounted in the root layout on every route. It reads
// the checked jurisdiction directory artifact (CAC-003) instead of the
// database, so rendering it costs no per-request round trips. The list is
// deploy-frozen: a new or renamed jurisdiction appears after the next deploy.
export function GlobalSearchWrapper() {
  const countries = directory.rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    iso2: row.iso2,
    capital: row.capital,
    status: { label: row.statusLabel },
  }));

  return <GlobalSearch countries={countries} />;
}
