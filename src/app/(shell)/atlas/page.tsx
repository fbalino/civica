import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import type { Country } from "@/components/atlas/data";
import { AtlasMapShellClient } from "@/components/atlas/AtlasMapShellClient";
import { withOg } from "@/lib/og";

export const revalidate = 3600;

export async function generateMetadata() {
  return {
    title: "Atlas — Civica",
    description:
      "Every government, every chamber, one interactive world map. Pan, zoom, and click any country to walk into its legislature.",
    openGraph: withOg({
      title: "Atlas — Civica",
      url: "https://civicaatlas.org/atlas",
    }),
  };
}

export default async function AtlasMapPage() {
  const { countries: dbCountries } = await loadAtlasData();
  const countries: Country[] = dbCountries.map((c) => ({
    id: c.id,
    slug: c.slug,
    iso2: c.iso2,
    name: c.name,
    leader: c.leader,
    gov: c.gov,
    govDetail: c.govDetail,
    region: c.region,
    pop: c.pop,
    gdp: c.gdp,
    capital: c.capital,
    featured: c.featured,
    masthead: c.masthead,
  }));

  return <AtlasMapShellClient countries={countries} />;
}
