import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { AtlasCountryShellClient } from "@/components/atlas/AtlasCountryShellClient";
import type { Country } from "@/components/atlas/data";
import {
  ATLAS_TAB_LABELS,
  isAtlasTab,
  slugToCountry,
} from "@/lib/atlas/ids";
import { db } from "@/lib/db";
import { jurisdictions } from "@/lib/db/schema";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
import type { ResolverOutput } from "@/lib/factbook/reconcile/types";

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

  // Phase F.4 — resolver-direct fetch for the masthead's pop + GDP
  // facts. Does one extra DB hit to map slug → jurisdictionId, then
  // a batch resolver call. Same pattern as the factbook header.
  // Falls back to plain SourceDots if the lookup fails.
  let headerFacts: {
    population: ResolverOutput | null;
    gdp: ResolverOutput | null;
  } = { population: null, gdp: null };
  try {
    const jrows = await db
      .select({ id: jurisdictions.id })
      .from(jurisdictions)
      .where(eq(jurisdictions.slug, match.slug))
      .limit(1);
    const jurisdictionId = jrows[0]?.id;
    if (jurisdictionId) {
      const facts = await getCanonicalFactsForJurisdiction(jurisdictionId, [
        "population_total",
        "gdp_ppp_usd_billions",
      ]);
      headerFacts = {
        population: facts["population_total"] ?? null,
        gdp: facts["gdp_ppp_usd_billions"] ?? null,
      };
    }
  } catch {
    // graceful degrade — plain SourceDots will render
  }

  return (
    <AtlasCountryShellClient
      country={country}
      dbCountries={dbCountries}
      dbChambers={dbChambers}
      headerFacts={headerFacts}
    />
  );
}
