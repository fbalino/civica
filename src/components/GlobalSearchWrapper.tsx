import { getAllJurisdictions } from "@/lib/db/queries";
import { readCachedFieldFromRow } from "@/lib/factbook/reconcile/api";
import { GlobalSearch } from "./GlobalSearch";

export async function GlobalSearchWrapper() {
  let countries: { slug: string; name: string; iso2: string | null; capital: string | null }[] = [];
  try {
    const all = await getAllJurisdictions();
    countries = all.map((c) => ({
      slug: c.slug,
      name: c.name,
      iso2: c.iso2,
      capital: readCachedFieldFromRow(c, "capital"),
    }));
  } catch {}

  return <GlobalSearch countries={countries} />;
}
