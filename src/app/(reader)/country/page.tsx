import type { Metadata } from "next";
import {
  getAllReferenceJurisdictions,
  getAlmanacFilterFacts,
} from "@/lib/db/queries";
import {
  FactbookAlmanac,
  type FactbookAlmanacCountry,
} from "@/components/factbook/FactbookAlmanac";

// /country landing — a full-bleed engraving hero (homepage style) with a
// centered typeahead + region quick-filter chips, over a dense alphabetical
// "almanac" index of every country. All layout/styling lives in the
// `.factbook-landing-*` classes in factbook.css.

export const metadata: Metadata = {
  title: "Countries & Areas — Reference Dossiers",
  description:
    "Browse reference dossiers for every country and territory on Earth: government, geography, people, and economy from the CIA World Factbook with Civica governance overlays.",
  alternates: { canonical: "https://civicaatlas.org/country" },
};

export const revalidate = 3600;

export default async function CountryIndexPage() {
  let countries: FactbookAlmanacCountry[] = [];
  let catalogAvailable = false;
  try {
    const [rows, filterFacts] = await Promise.all([
      getAllReferenceJurisdictions(),
      getAlmanacFilterFacts(),
    ]);
    countries = rows.map((row) => {
      const facts = filterFacts[row.id];
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        iso2: row.iso2,
        iso3: row.iso3,
        capital: row.capital,
        continent: row.continent,
        // Phase F peer-grouping canonical facts (human-readable strings)
        // drive the advanced filter bar.
        region: facts?.region ?? null,
        incomeGroup: facts?.incomeGroup ?? null,
        regimeType: facts?.regimeType ?? null,
        status: row.jurisdictionStatus,
      };
    });
    catalogAvailable = true;
  } catch {
    // DB not connected — render the shell without claiming a zero-row atlas.
  }

  // FactbookAlmanac seeds shareable region/filter URL state client-side from
  // window.location (NOT useSearchParams) so this route stays statically
  // exported with the full index in the HTML — no Suspense/CSR bailout.
  return (
    <FactbookAlmanac
      countries={countries}
      catalogAvailable={catalogAvailable}
    />
  );
}
