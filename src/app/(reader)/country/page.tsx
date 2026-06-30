import type { Metadata } from "next";
import { getAllJurisdictions } from "@/lib/db/queries";
import {
  FactbookAlmanac,
  type FactbookAlmanacCountry,
} from "@/components/factbook/FactbookAlmanac";

// /country landing — a full-bleed engraving hero (homepage style) with a
// centered typeahead + region quick-filter chips, over a dense alphabetical
// "almanac" index of every country. All layout/styling lives in the
// `.factbook-landing-*` classes in factbook.css.

export const metadata: Metadata = {
  title: "Countries — Every Country",
  description:
    "Reference dossiers for every country and territory. Sourced from the CIA World Factbook with Civica governance overlays.",
  alternates: { canonical: "https://civicaatlas.org/country" },
};

export const revalidate = 3600;

export default async function CountryIndexPage() {
  let countries: FactbookAlmanacCountry[] = [];
  try {
    const rows = await getAllJurisdictions();
    countries = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      iso2: row.iso2,
      iso3: row.iso3,
      capital: row.capital,
      continent: row.continent,
    }));
  } catch {
    // DB not connected — render the shell; the almanac degrades to empty.
  }

  return <FactbookAlmanac countries={countries} />;
}
