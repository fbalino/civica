import type { Metadata } from "next";
import { HomeClean } from "@/components/home/HomeClean";
import { HomeGrid } from "@/components/home/HomeGrid";
import { HomeWiki } from "@/components/home/HomeWiki";
import { civicaIndex } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Civica — Atlas of Governance",
  description:
    `Interactive reference for how every country is governed. 250+ nations, ${civicaIndex.dimensionCount} dimensions, live Pulse signals. Civica replaces the CIA World Factbook with a modern, citable atlas.`,
  alternates: { canonical: "https://civicaatlas.org" },
  openGraph: {
    title: "Civica — Atlas of Governance",
    description:
      `Interactive reference for how every country is governed. 250+ nations, ${civicaIndex.dimensionCount} dimensions, live Pulse signals.`,
    url: "https://civicaatlas.org",
    type: "website",
  },
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ home?: string }>;
}) {
  // Phase F — A/B mockup of two homepage variants behind ?home=.
  // ?home=clean → minimalist circle-mark + tagline + CTAs
  // ?home=wiki  → 6-card directory with rankings + recent feeds
  // No param → use the editorial grid homepage.
  const sp = await searchParams;
  if (sp.home === "grid") return <HomeGrid />;
  if (sp.home === "clean") return <HomeClean />;
  if (sp.home === "wiki") return <HomeWiki />;
  return <HomeGrid />;
}
