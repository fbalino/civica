import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { AtlasCountryShellClient } from "@/components/atlas/AtlasCountryShellClient";
import type { Country } from "@/components/atlas/data";
import {
  ATLAS_TAB_LABELS,
  isAtlasTab,
  slugToCountry,
} from "@/lib/atlas/ids";

interface PageProps {
  params: Promise<{ slug: string; tab: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, tab } = await params;
  const tabLabel = isAtlasTab(tab) ? ATLAS_TAB_LABELS[tab] : "Country";
  return {
    title: `${slug} · ${tabLabel} — Civica Atlas`,
    // Canonical OG URL points at the reader view for clean social previews.
    openGraph: {
      title: `${slug} · ${tabLabel} — Civica Atlas`,
      url: `https://civicaatlas.org/countries/${slug}`,
    },
  };
}

export default async function AtlasCountryPage({ params }: PageProps) {
  const { slug, tab } = await params;
  if (!isAtlasTab(tab)) notFound();

  const { countries: dbCountries, chambers: dbChambers } = await loadAtlasData();
  const match = slugToCountry(slug, dbCountries);
  if (!match) notFound();

  const country: Country = {
    id: match.id,
    slug: match.slug,
    iso2: match.iso2,
    name: match.name,
    leader: match.leader,
    gov: match.gov,
    govDetail: match.govDetail,
    region: match.region,
    pop: match.pop,
    gdp: match.gdp,
    capital: match.capital,
    featured: match.featured,
    masthead: match.masthead,
  };

  return (
    <AtlasCountryShellClient
      country={country}
      dbCountries={dbCountries}
      dbChambers={dbChambers}
    />
  );
}
