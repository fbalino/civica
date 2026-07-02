"use client";

import { HeroReveal, HeroRevealItem } from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import {
  CountrySearchCombobox,
  type CountrySearchOption,
} from "@/components/CountrySearchCombobox";

/**
 * ConstitutionHero — the full-bleed engraving hero for the /constitution
 * landing state, matching the homepage / /country almanac hero pattern
 * (eyebrow → serif title → dek → canonical typeahead), all wired with
 * HeroReveal + a ParallaxImage engraving.
 *
 * Reuses the generic `.factbook-landing-hero` / `.factbook-hero-*` class
 * family from factbook.css (those classes are page-agnostic despite the
 * filename) rather than inventing constitution-prefixed variants.
 *
 * The typeahead routes to `/constitution?c=<slug>` (the explorer's reading
 * state) via `hrefForCountry`, not the default `/country/<slug>`.
 */
export function ConstitutionHero({
  countries,
}: {
  countries: ReadonlyArray<CountrySearchOption>;
}) {
  return (
    <section
      className="factbook-landing-hero"
      aria-labelledby="constitution-hero-title"
    >
      <ParallaxImage
        className="factbook-hero-art"
        src="/engravings/hero.webp"
        darkSrc="/engravings/hero-dark.webp"
        alt=""
        aria-hidden="true"
      />
      <div className="factbook-hero-scrim" aria-hidden="true" />
      <HeroReveal className="factbook-hero-inner">
        <HeroRevealItem className="factbook-hero-eyebrow">
          Constitution Explorer
        </HeroRevealItem>
        <HeroRevealItem
          as="h1"
          id="constitution-hero-title"
          className="factbook-hero-title"
        >
          Read and compare the world&apos;s constitutions.
        </HeroRevealItem>
        <HeroRevealItem as="p" className="factbook-hero-dek">
          Read any national constitution in full, then compare &mdash; side by
          side &mdash; how different countries answer the same question. Every
          passage is drawn from the Constitute Project.
        </HeroRevealItem>

        <HeroRevealItem className="factbook-hero-search">
          <CountrySearchCombobox
            countries={countries}
            hrefForCountry={(c) =>
              `/constitution?c=${encodeURIComponent(c.slug)}`
            }
            placeholder="Search any constitution&hellip;"
            ariaLabel="Search constitutions"
          />
        </HeroRevealItem>
      </HeroReveal>
    </section>
  );
}
