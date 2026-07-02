"use client";

import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";
import type { IndexedConstitutionCountry } from "@/lib/db/queries-constitution";

interface FeaturedTopic {
  key: string;
  label: string;
}

interface ConstitutionLandingProps {
  countries: IndexedConstitutionCountry[];
  featuredTopics: FeaturedTopic[];
  /** A default country to open when a featured topic is clicked. */
  defaultSlug: string;
}

/** A few widely-recognized constitutions to seed the picker. */
const SUGGESTED_SLUGS = [
  "united-states",
  "france",
  "germany",
  "japan",
  "brazil",
  "india",
  "south-africa",
  "mexico",
];

/**
 * The `?c=`-less landing state: a short intro, a prominent country picker, and
 * featured topics. Selecting anything routes to the 3-pane explorer.
 */
export function ConstitutionLanding({
  countries,
  featuredTopics,
  defaultSlug,
}: ConstitutionLandingProps) {
  const bySlug = new Map(countries.map((c) => [c.slug, c]));
  // A curated shortlist, but rendered ALPHABETICALLY like every other country
  // list on this page (a hand-ordered list read as random).
  const suggestions = SUGGESTED_SLUGS.map((s) => bySlug.get(s))
    .filter((c): c is IndexedConstitutionCountry => c != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="constitution-landing">
      <p className="constitution-landing-lede">
        {countries.length} national constitutions are indexed here, topic by
        topic — from human dignity and term limits to emergency powers and the
        structure of the courts — so you can trace how each one answers the same
        question.
      </p>

      <section className="constitution-landing-section">
        <h2 className="constitution-landing-heading">Start with a country</h2>
        <p className="constitution-landing-topic-note">
          Jump to a widely-read constitution below, or use the search at the top
          to open any of the {countries.length} on file.
        </p>
        <div className="constitution-landing-grid">
          {suggestions.map((c) => (
            <Link
              key={c.slug}
              href={`/constitution?c=${encodeURIComponent(c.slug)}`}
              className="constitution-landing-card"
            >
              <span className="constitution-landing-card-flag" aria-hidden>
                <CountryFlag iso2={c.iso2} size={22} />
              </span>
              <span className="constitution-landing-card-name">{c.name}</span>
              {c.year ? (
                <span className="constitution-landing-card-year">{c.year}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      <section className="constitution-landing-section">
        <h2 className="constitution-landing-heading">Explore by topic</h2>
        <p className="constitution-landing-topic-note">
          Open the {bySlug.get(defaultSlug)?.name ?? "reader"} and jump straight
          to how each of these questions is answered:
        </p>
        <div className="constitution-landing-topics">
          {featuredTopics.map((t) => (
            <Link
              key={t.key}
              // `?topic=` is a real query param the explorer reads on mount to
              // preselect the cross-reference topic — not a dead `#topic-` hash
              // (no code ever read the anchor). Kept out of the reading
              // column's scroll-spy state so it only seeds the compare pane.
              href={`/constitution?c=${encodeURIComponent(defaultSlug)}&topic=${encodeURIComponent(t.key)}`}
              className="constitution-topic-chip"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
