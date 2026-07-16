import { loadAtlasData, loadAtlasLayerData } from "@/lib/atlas/load-atlas-data";
import type { Country } from "@/components/atlas/data";
import { AtlasStandaloneClient } from "@/components/atlas/AtlasStandaloneClient";
import { parseLayerParam } from "@/lib/atlas/map-layers";
import { withOg } from "@/lib/og";

export const revalidate = 0;

export async function generateMetadata() {
  return {
    title: "World Atlas — Interactive Government Map",
    description:
      "An interactive map of map-eligible sovereign-state entries. Pan, zoom, and open a profile with source-linked governance data.",
    alternates: { canonical: "https://civicaatlas.org/atlas" },
    openGraph: withOg({
      title: "World Atlas — Interactive Government Map · Civica Atlas",
      description:
        "An interactive map of map-eligible sovereign-state entries. Open any mapped profile for governance data and sources.",
      url: "https://civicaatlas.org/atlas",
    }),
  };
}

// Standalone /atlas (Option B, Phase 2): the choropleth world map rendered
// directly inside the root layout (SiteHeader + main + footer), with NO
// three-pane shell, no left/right rails, no ShellContext. The map fills the
// viewport below the header; clicking a country opens its factbook entry.
export default async function AtlasMapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const layerParam = sp.layer;
  const initialLayer = parseLayerParam(
    Array.isArray(layerParam) ? layerParam[0] : layerParam,
  );
  const [{ countries: dbCountries }, layerData] = await Promise.all([
    loadAtlasData(),
    loadAtlasLayerData(),
  ]);
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
    jurisdictionStatus: c.jurisdictionStatus,
  }));

  return (
    <AtlasStandaloneClient
      countries={countries}
      layerData={layerData}
      initialLayer={initialLayer}
    />
  );
}
