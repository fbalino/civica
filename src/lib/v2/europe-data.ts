/*
 * V2 preview — server-side data for the Europe choropleth.
 *
 * Returns one row per European country with everything the hover
 * card needs: name, ISO codes, government type, GDP per capita,
 * population. Image URLs are NOT fetched here — the client
 * component pulls them lazily on first hover via Wikipedia REST.
 */

import { db } from "@/lib/db";
import { jurisdictions } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

// UN definition of Europe + a few overseas dependencies that
// surface in the world-atlas TopoJSON. Russia is included; the
// viewBox in the map clips it to its European portion.
export const EUROPEAN_ISO3 = [
  "alb", "and", "aut", "blr", "bel", "bih", "bgr", "hrv", "cyp", "cze",
  "dnk", "est", "fin", "fra", "deu", "grc", "hun", "isl", "irl", "ita",
  "kos", "lva", "lie", "ltu", "lux", "mlt", "mda", "mco", "mne", "nld",
  "mkd", "nor", "pol", "prt", "rou", "rus", "smr", "srb", "svk", "svn",
  "esp", "swe", "che", "tur", "ukr", "gbr", "vat",
] as const;

export type EuropeCountryView = {
  id: string;            // alpha-3 ISO code (matches our jurisdictions.id convention)
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string;
  governmentType: string | null;
  population: number | null;
  gdpBillions: number | null;
  /** Computed nominal GDP per capita in USD (best effort from cache columns). */
  gdpPerCapita: number | null;
  capital: string | null;
};

export async function getEuropeCountryViews(): Promise<EuropeCountryView[]> {
  const rows = await db
    .select({
      id: jurisdictions.id,
      slug: jurisdictions.slug,
      name: jurisdictions.name,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
      governmentType: jurisdictions.governmentType,
      population: jurisdictions.population,
      gdpBillions: jurisdictions.gdpBillions,
      capital: jurisdictions.capital,
    })
    .from(jurisdictions)
    .where(
      inArray(
        jurisdictions.iso3,
        EUROPEAN_ISO3.map((c) => c.toUpperCase()),
      ),
    );

  return rows.map((r) => {
    const gdpPerCapita =
      r.gdpBillions && r.population && r.population > 0
        ? Math.round((r.gdpBillions * 1e9) / r.population)
        : null;
    return {
      id: (r.iso3 ?? r.id).toLowerCase(),
      slug: r.slug,
      name: r.name,
      iso2: r.iso2,
      iso3: (r.iso3 ?? "").toLowerCase(),
      governmentType: r.governmentType,
      population: r.population,
      gdpBillions: r.gdpBillions,
      gdpPerCapita,
      capital: r.capital,
    };
  });
}
