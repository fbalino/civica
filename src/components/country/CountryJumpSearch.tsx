"use client";

import { useId } from "react";
import {
  FactbookCountrySearch,
  type FactbookCountryOption,
} from "@/components/factbook/FactbookCountrySearch";
import { FactbookStickyCountrySearch } from "@/components/factbook/FactbookStickyCountrySearch";

/**
 * CountryJumpSearch — the reusable "jump to another country" handoff.
 *
 * Drop this in ONCE at the very top of a country tab's content and you get the
 * full two-part search experience for free, with the guarantee that exactly ONE
 * search bar is ever visible at a time:
 *
 *   1. An in-content "Jump to country…" field that sits in the NORMAL SCROLL
 *      FLOW (so it scrolls away as the reader moves down the page).
 *   2. A sentinel placed immediately AFTER that field.
 *   3. The shared sticky top bar (<FactbookStickyCountrySearch>), wired to that
 *      same sentinel. The sticky bar reveals ONLY once the in-content field has
 *      scrolled out of view — so the reader sees the in-content field at the
 *      top, then it's gone and only the sticky bar shows. Never both.
 *
 * Why this is robust across layouts: the in-content field is a normal-flow
 * element, NOT part of any sticky region. A tab's section nav / sidebar TOC can
 * still be `position: sticky` BELOW this component — that stickiness no longer
 * traps the search on screen, because the search lives above it in plain flow
 * and the reveal is driven by the search's own sentinel leaving the viewport.
 *
 * Usage (a future tab adds the whole behavior in one line):
 *
 *   <CountryJumpSearch
 *     country={{ name: jurisdiction.name, iso2: jurisdiction.iso2 }}
 *     countries={countryOptions}
 *   />
 *
 * Then render the tab's nav/sidebar + content as usual below it. The sticky bar
 * is self-contained here, so the surrounding layout owns no search coordination.
 *
 * Notes:
 * - The sentinel id is generated per-instance (useId) so multiple mounts can't
 *   collide. Render exactly one CountryJumpSearch per page.
 * - `enableShortcut` wires ⌘K focus on the in-content field; the sticky bar
 *   keeps its own ⌘K affordance once revealed.
 */
interface CountryJumpSearchProps {
  /** The country whose page this is — drives the sticky bar's flag + name. */
  country: { name: string; iso2: string | null };
  /** All selectable countries for the combobox. Empty → nothing renders. */
  countries: ReadonlyArray<FactbookCountryOption>;
  /** Placeholder for both the in-content field and the sticky bar. */
  placeholder?: string;
  /** Accessible label for both fields. */
  ariaLabel?: string;
  /** Extra class on the in-content wrapper (e.g. to constrain its width). */
  className?: string;
}

export function CountryJumpSearch({
  country,
  countries,
  placeholder = "Jump to country...",
  ariaLabel = "Jump to a country",
  className,
}: CountryJumpSearchProps) {
  // Stable, collision-free sentinel id shared between the in-content field's
  // sentinel and the sticky bar's IntersectionObserver target.
  const reactId = useId();
  const sentinelId = `country-jump-sentinel-${reactId.replace(/:/g, "")}`;

  if (countries.length === 0) return null;

  return (
    <>
      {/* In-content field — NORMAL FLOW, so it scrolls away. The section
       *  nav / sidebar below this can stay sticky without trapping it. */}
      <div
        className={`country-jump-search${className ? ` ${className}` : ""}`}
      >
        <FactbookCountrySearch
          countries={countries}
          countryPathPrefix="/country"
          placeholder={placeholder}
          ariaLabel={ariaLabel}
          compact
        />
      </div>

      {/* Reveal sentinel — sits right after the in-content field. The sticky
       *  bar reveals exactly when this leaves the viewport (i.e. once the
       *  in-content field has scrolled out of view). */}
      <div id={sentinelId} aria-hidden="true" className="country-jump-sentinel" />

      {/* Shared sticky top bar — the single canonical implementation. Hidden
       *  at scrollTop=0; reveals only via the IntersectionObserver above. */}
      <FactbookStickyCountrySearch
        country={country}
        countries={countries}
        sentinelId={sentinelId}
      />
    </>
  );
}
