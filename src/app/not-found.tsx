import type { Metadata } from "next";
import Link from "next/link";
import { getAllReferenceJurisdictions } from "@/lib/db/queries";
import { readCachedFieldFromRow } from "@/lib/factbook/reconcile/api";
import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";
import { HeroReveal, HeroRevealItem } from "@/components/motion/Reveal";
import "./not-found.css";

export const metadata: Metadata = {
  title: "Page Not Found — 404",
  description:
    "This address isn't in the Civica atlas. Search for a country or head to Governance Evidence, World Atlas, Elections, Compare, or The Record.",
  robots: { index: false, follow: false },
};

const DESTINATIONS: ReadonlyArray<{
  href: string;
  label: string;
  description: string;
}> = [
  {
    href: "/country",
    label: "Countries",
    description: "Government structures and source-linked country profiles.",
  },
  {
    href: "/governance-evidence",
    label: "Governance Evidence",
    description: "Source-native governance indicators with provenance.",
  },
  {
    href: "/atlas",
    label: "World Atlas",
    description: "The interactive map of world political systems.",
  },
  {
    href: "/elections",
    label: "Elections",
    description: "National election calendars and results.",
  },
  {
    href: "/compare",
    label: "Compare",
    description: "Place countries side by side.",
  },
  {
    href: "/blog",
    label: "The Record",
    description: "Field notes on governance and the data behind it.",
  },
];

/* The compass spot-engraving. Light + dark variants swap via the global
   .theme-engraving-light / .theme-engraving-dark rules in globals.css. */
function CompassEngraving() {
  return (
    <div className="not-found__engraving" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="theme-engraving-light"
        src="/engravings/spot-compass.webp"
        alt=""
        aria-hidden="true"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="theme-engraving-dark"
        src="/engravings/spot-compass-dark.webp"
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}

export default async function NotFound() {
  // Soft-fail: the search is real when the DB is reachable, and the page still
  // renders coherently (an empty combobox) when it is not.
  let countries: {
    slug: string;
    name: string;
    iso2: string | null;
    iso3: string | null;
    capital: string | null;
  }[] = [];
  try {
    const all = await getAllReferenceJurisdictions();
    countries = all.map((c) => ({
      slug: c.slug,
      name: c.name,
      iso2: c.iso2,
      iso3: c.iso3,
      capital: readCachedFieldFromRow(c, "capital"),
    }));
  } catch {
    countries = [];
  }

  return (
    <HeroReveal as="div" className="editorial-page not-found">
      <HeroRevealItem>
        <CompassEngraving />
      </HeroRevealItem>

      <HeroRevealItem as="p" className="editorial-eyebrow not-found__eyebrow">
        Error 404 · Terra incognita
      </HeroRevealItem>

      <HeroRevealItem as="h1" className="not-found__title">
        This page is off the map.
      </HeroRevealItem>

      <HeroRevealItem as="p" className="not-found__dek">
        This address isn&rsquo;t in the atlas. It may have moved when routes
        were consolidated, or never existed.
      </HeroRevealItem>

      <HeroRevealItem className="not-found__search">
        <CountrySearchCombobox
          countries={countries}
          countryPathPrefix="/country"
          placeholder="Find a country…"
          ariaLabel="Find a country"
        />
      </HeroRevealItem>

      <HeroRevealItem
        as="section"
        className="not-found__destinations"
        aria-labelledby="not-found-destinations"
      >
        <h2
          id="not-found-destinations"
          className="not-found__destinations-title"
        >
          Places to pick up the trail
        </h2>
        <ul className="not-found__grid">
          {DESTINATIONS.map((destination) => (
            <li key={destination.href}>
              <Link href={destination.href} className="not-found__card">
                <span className="not-found__card-label">
                  {destination.label}
                </span>
                <span className="not-found__card-desc">
                  {destination.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </HeroRevealItem>

      <HeroRevealItem as="p" className="not-found__note">
        Convinced this page should exist? <Link href="/contact">Tell us.</Link>
      </HeroRevealItem>
    </HeroReveal>
  );
}
