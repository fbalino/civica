"use client";

import { useEffect, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import {
  FactbookCountrySearch,
  type FactbookCountryOption,
} from "./FactbookCountrySearch";

interface FactbookStickyCountrySearchProps {
  country: {
    name: string;
    iso2: string | null;
  };
  countries: ReadonlyArray<FactbookCountryOption>;
  sentinelId: string;
}

export function FactbookStickyCountrySearch({
  country,
  countries,
  sentinelId,
}: FactbookStickyCountrySearchProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let rafId: number | null = null;
    let cancelled = false;

    // The sentinel is plain server-rendered markup, so it should already be
    // in the DOM by the time this effect runs. But fail SAFE if it isn't
    // found yet (e.g. a transient timing hiccup): poll across a few frames
    // instead of giving up and forcing the bar visible. The bar must never
    // default to visible — only a confirmed "sentinel scrolled ABOVE the
    // header" from the observer should ever flip it on.
    const tryAttach = () => {
      if (cancelled) return;
      const sentinel = document.getElementById(sentinelId);
      if (!sentinel) {
        rafId = window.requestAnimationFrame(tryAttach);
        return;
      }

      // DIRECTION-AWARE reveal. The sentinel sits right after the in-content
      // search. `!isIntersecting` alone is WRONG: it's also true when the
      // sentinel is still BELOW the fold (e.g. a short viewport where the tall
      // masthead pushes the in-content search near the bottom edge at
      // scrollTop=0). Revealing then would show BOTH bars at once. So reveal
      // ONLY once the sentinel has passed ABOVE the header line — i.e. its top
      // is at/above HEADER_OFFSET. While it's on screen OR below the fold, the
      // in-content search is still the one in play, so the sticky bar stays
      // hidden. This is read from the entry's own boundingClientRect (which IO
      // recomputes on each callback), so it never force-shows.
      const HEADER_OFFSET = 56;
      observer = new IntersectionObserver(
        ([entry]) => {
          setVisible(entry.boundingClientRect.top <= HEADER_OFFSET && !entry.isIntersecting);
        },
        { rootMargin: `-${HEADER_OFFSET}px 0px 0px 0px`, threshold: 0 }
      );
      observer.observe(sentinel);
    };

    tryAttach();

    return () => {
      cancelled = true;
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [sentinelId]);

  return (
    <div
      className={`factbook-sticky-country-search${visible ? " is-visible" : ""}`}
    >
      <div className="factbook-sticky-country-search__inner">
        <div className="factbook-sticky-country-search__country">
          <CountryFlag iso2={country.iso2} size={24} />
          <span>{country.name}</span>
        </div>
        <FactbookCountrySearch
          countries={countries}
          compact
          showShortcut
          enableShortcut
          placeholder="Jump to country..."
          ariaLabel="Jump to a country factbook"
        />
      </div>
    </div>
  );
}
