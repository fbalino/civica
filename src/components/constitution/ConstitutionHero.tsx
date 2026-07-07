"use client";

import { PageHero } from "@/components/PageHero";
import {
  CountrySearchCombobox,
  type CountrySearchOption,
} from "@/components/CountrySearchCombobox";

/**
 * ConstitutionHero — the /constitution landing hero, built on the canonical
 * <PageHero> shell (eyebrow → serif title → dek → canonical typeahead). This
 * stays a thin client wrapper only because the typeahead routes to
 * `/constitution?c=<slug>` via an inline `hrefForCountry` callback; PageHero
 * itself is the shared shell that every browse/landing page uses.
 */
export function ConstitutionHero({
  countries,
}: {
  countries: ReadonlyArray<CountrySearchOption>;
}) {
  return (
    <PageHero
      eyebrow="Constitution Explorer"
      titleId="constitution-hero-title"
      title="Read and compare the world's constitutions."
      description={
        <>
          Read any national constitution in full, then compare &mdash; side by
          side &mdash; how different countries answer the same question. Every
          passage is drawn from the Constitute Project.
        </>
      }
      engraving={{
        src: "/engravings/hero.webp",
        darkSrc: "/engravings/hero-dark.webp",
      }}
      search={
        <CountrySearchCombobox
          countries={countries}
          hrefForCountry={(c) => `/constitution?c=${encodeURIComponent(c.slug)}`}
          placeholder="Search any constitution&hellip;"
          ariaLabel="Search constitutions"
        />
      }
    />
  );
}
