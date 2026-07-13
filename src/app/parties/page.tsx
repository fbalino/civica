import type { Metadata } from "next";
import Link from "next/link";
import { withOg } from "@/lib/og";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { PageHero } from "@/components/PageHero";
import {
  getPartiesForBrowser,
  getPartyBrowserFacets,
  type BrowserParty,
  type PartyBrowserFacets,
} from "@/lib/db/queries-parties";
import { PartyExplorer } from "@/components/parties/PartyExplorer";

import "../parties.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Political Parties — Ideology & Seats Worldwide",
  description:
    "Browse every governing and opposition party across the world's legislatures on one ideology compass — economic left–right against anti-pluralism, with seat shares and V-Party positions.",
  alternates: { canonical: "https://civicaatlas.org/parties" },
  openGraph: withOg({
    title: "Political Parties — Ideology & Seats Worldwide · Civica Atlas",
    description:
      "Every governing and opposition party across the world's legislatures on one ideology compass — economic left–right against anti-pluralism, with seat shares and V-Party positions.",
    url: "https://civicaatlas.org/parties",
  }),
};

export default async function PartiesPage() {
  // Fetch the browser data. Each query soft-fails to an empty/zeroed shape, so
  // the page renders coherently when the DB is unreachable.
  let parties: BrowserParty[] = [];
  let facets: PartyBrowserFacets = {
    countries: [],
    regions: [],
    totalParties: 0,
    partiesWithPosition: 0,
    totalSeats: 0,
    seatsWithPosition: 0,
  };
  try {
    [parties, facets] = await Promise.all([
      getPartiesForBrowser(),
      getPartyBrowserFacets(),
    ]);
  } catch {
    // queries already soft-fail internally; this guards the Promise.all itself.
  }

  const countryCount = facets.countries.length;

  return (
    <>
      {/* Canonical full-bleed page hero (shared PageHero shell). */}
      <PageHero
        eyebrow="Political parties"
        titleId="parties-hero-title"
        title="Every party, on one ideology compass"
        description={
          <>
            The governing and opposition parties of{" "}
            {countryCount > 0 ? countryCount.toLocaleString() : "the world's"}{" "}
            legislatures, placed on an economic left–right axis against an
            anti-pluralism axis. Ideology positions come from the V-Party dataset
            (V-Dem); seat counts come from IPU Parline and Wikidata. Recorded
            ideology positions and seat counts retain their named source; where
            no position is recorded, the party is listed honestly rather than
            guessed.
          </>
        }
      />

      <EditorialPage width="full">
      {parties.length > 0 ? (
        <PartyExplorer
          parties={parties}
          countries={facets.countries.map((c) => ({
            name: c.name,
            slug: c.slug,
            region: c.region,
          }))}
          regions={facets.regions}
          coverage={{
            totalParties: facets.totalParties,
            partiesWithPosition: facets.partiesWithPosition,
            totalSeats: facets.totalSeats,
            seatsWithPosition: facets.seatsWithPosition,
          }}
        />
      ) : (
        <p className="editorial-empty">
          Party data is temporarily unavailable. Please try again shortly.
        </p>
      )}

      <p className="parties-source-footnote">
        <strong>Sources.</strong> Ideology positions: V-Party v2 (V-Dem
        Institute, CC-BY-SA), which codes multiparty competition through 2019 —
        parties formed or renamed since, and parties in single-party
        legislatures, carry no position and are never plotted. Seat counts: IPU
        Parline and Wikidata. The vertical axis measures{" "}
        <em>anti-pluralism</em> — a commitment-to-democratic-norms index — not
        the political-compass meme&rsquo;s authoritarian–libertarian axis.{" "}
        <Link href="/civica-index/methodology">Read the methodology.</Link>
      </p>
      </EditorialPage>
    </>
  );
}
