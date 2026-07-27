import { getAllReferenceJurisdictions } from "@/lib/db/queries";
import { readCachedFieldFromRow } from "@/lib/factbook/reconcile/api";
import type { JurisdictionStatusPresentation } from "@/lib/jurisdictions/status-presentation";
import { GlobalSearch } from "./GlobalSearch";

export async function GlobalSearchWrapper() {
  let countries: Array<{
    slug: string;
    name: string;
    iso2: string | null;
    capital: string | null;
    status: JurisdictionStatusPresentation;
  }> = [];
  try {
    const all = await getAllReferenceJurisdictions();
    countries = all.map((c) => ({
      slug: c.slug,
      name: c.name,
      iso2: c.iso2,
      capital: readCachedFieldFromRow(c, "capital"),
      status: c.jurisdictionStatus,
    }));
  } catch {}

  return <GlobalSearch countries={countries} />;
}
