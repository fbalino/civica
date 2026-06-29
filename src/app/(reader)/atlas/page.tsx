import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import type { Country } from "@/components/atlas/data";
import { AtlasStandaloneClient } from "@/components/atlas/AtlasStandaloneClient";
import { withOg } from "@/lib/og";

export const revalidate = 3600;

export async function generateMetadata() {
  return {
    title: "Atlas — Civica",
    description:
      "Every government, every chamber, one interactive world map. Pan, zoom, and click any country to open its factbook entry.",
    openGraph: withOg({
      title: "Atlas — Civica",
      url: "https://civicaatlas.org/atlas",
    }),
  };
}

// Standalone /atlas (Option B, Phase 2): the choropleth world map rendered
// directly inside the root layout (SiteHeader + main + footer), with NO
// three-pane shell, no left/right rails, no ShellContext. The map fills the
// viewport below the header; clicking a country opens its factbook entry.
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

  return <AtlasStandaloneClient countries={countries} />;
}
