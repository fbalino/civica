import type { Metadata } from "next";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import type { Country } from "@/components/atlas/data";
import { CompareInAtlasClient } from "@/components/atlas/CompareInAtlasClient";

export const metadata: Metadata = {
  title: "Compare — Atlas — Civica",
  description:
    "Quick side-by-side compare. Two countries, two chambers, two seat maps. The fast in-atlas compare.",
};

interface PageProps {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export default async function AtlasComparePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { countries: dbCountries, chambers: dbChambers } = await loadAtlasData();

  // Pick reasonable defaults the legacy view shipped with.
  const a =
    sp.a && dbCountries.find((c) => c.id === sp.a || c.slug === sp.a)
      ? (dbCountries.find((c) => c.id === sp.a || c.slug === sp.a)!.id)
      : "fra";
  const b =
    sp.b && dbCountries.find((c) => c.id === sp.b || c.slug === sp.b)
      ? (dbCountries.find((c) => c.id === sp.b || c.slug === sp.b)!.id)
      : "usa";

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

  return (
    <CompareInAtlasClient
      countries={countries}
      dbChambers={dbChambers}
      initialA={a}
      initialB={b}
    />
  );
}
