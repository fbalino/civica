import type { Metadata } from "next";
import { HomeGrid } from "@/components/home/HomeGrid";
import { civicaIndex } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Civica — Atlas of Governance",
  description:
    `Interactive reference for how every country is governed. 250+ nations, ${civicaIndex.dimensionCount} dimensions, event-sensitive Pulse signals. Civica replaces the CIA World Factbook with a modern, citable atlas.`,
  alternates: { canonical: "https://civicaatlas.org" },
  openGraph: {
    title: "Civica — Atlas of Governance",
    description:
      `Interactive reference for how every country is governed. 250+ nations, ${civicaIndex.dimensionCount} dimensions, event-sensitive Pulse signals.`,
    url: "https://civicaatlas.org",
    type: "website",
  },
};

export default function LandingPage() {
  return <HomeGrid />;
}
