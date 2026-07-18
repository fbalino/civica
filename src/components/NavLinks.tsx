"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { INDEX_NAV_ITEMS } from "@/components/indexNavItems";
import { METHODOLOGY_NAV_ITEMS } from "@/components/methodologyNavItems";
import { EXPLORE_NAV_GROUPS } from "@/components/exploreNavItems";
import { EDITORIAL_NAV_ITEMS } from "@/components/editorialNavItems";
import { ThemedDecorativeImage } from "@/components/ThemedDecorativeImage";
import {
  isExploreGroupActive,
  isGovernanceEvidenceGroupActive,
  isMethodologyGroupActive,
} from "@/components/navActiveState";

/** All hrefs that live under the "Explore" megamenu — used to light the
 * trigger active when the reader is on any of the eight browse surfaces. */
const EXPLORE_HREFS = EXPLORE_NAV_GROUPS.flatMap((g) =>
  g.items.map((i) => i.href),
);

/** Menu art is mounted only after the disclosure opens, then resolves exactly
 * one active-theme asset instead of transferring a hidden counterpart. */
function ExploreEngraving({
  engraving,
  shouldLoad,
}: {
  engraving: string;
  shouldLoad: boolean;
}) {
  return (
    <span className="explore-item__engraving" aria-hidden="true">
      {shouldLoad ? (
        <ThemedDecorativeImage
          src={`/engravings/navigation/spot-${engraving}.webp`}
          darkSrc={`/engravings/navigation/spot-${engraving}-dark.webp`}
        />
      ) : null}
    </span>
  );
}

export function NavLinks() {
  const pathname = usePathname();

  const isActiveHref = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  const indexActive = isGovernanceEvidenceGroupActive(pathname);

  const methodologyActive = isMethodologyGroupActive(pathname);

  // Exclude the Methodology surfaces: they physically live under
  // `/country/methodology`, whose `/country` prefix would otherwise light
  // BOTH the Explore trigger and the Methodology trigger on the same page.
  // Methodology wins that overlap — the reader is reading methodology, not
  // browsing a country.
  const exploreActive = isExploreGroupActive(pathname, EXPLORE_HREFS);

  // Track the Explore panel's open state so `aria-expanded` stays truthful and
  // Escape closes it. The CSS `:hover`/`:focus-within` reveal is the visual
  // driver (and a no-JS fallback); this state mirrors it. A short close delay
  // gives hover-intent so a diagonal mouse path to the panel doesn't flicker.
  const [exploreOpen, setExploreOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openExplore = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setExploreOpen(true);
  };
  const closeExploreSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setExploreOpen(false), 120);
  };

  // Clear any pending close timer on unmount so it can't fire setState
  // after the component is gone.
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <div
        className="nav-dropdown"
        onMouseEnter={openExplore}
        onFocus={openExplore}
        onMouseLeave={closeExploreSoon}
        onBlur={(e) => {
          // Close only when focus leaves the whole dropdown (trigger + panel).
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setExploreOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && exploreOpen) {
            setExploreOpen(false);
            (e.currentTarget.querySelector(
              ".nav-dropdown-trigger",
            ) as HTMLElement | null)?.focus();
          }
        }}
      >
        <button
          type="button"
          className={`tab-nav nav-dropdown-trigger ${
            exploreActive ? "tab-nav--active" : ""
          }`}
          aria-haspopup="true"
          aria-expanded={exploreOpen}
          onClick={openExplore}
        >
          Explore
          <ChevronDown
            className="nav-dropdown-chevron"
            aria-hidden="true"
            focusable="false"
          />
        </button>
        {/* No `role="menu"`/`menuitem"` here: this is a disclosure panel of
            plain links, not an ARIA menu widget (which would promise
            arrow-key/typeahead traversal we don't implement). Tab moves
            through the links, matching the Index / Methodology dropdowns
            below, which also carry no ARIA menu roles. */}
        <div
          className={`nav-dropdown-menu explore-menu ${
            exploreOpen ? "explore-menu--open" : ""
          }`}
          aria-label="Explore Civica Atlas"
        >
          {EXPLORE_NAV_GROUPS.map((group) => (
            <div className="explore-col" key={group.label}>
              <p className="explore-col-label">{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`explore-item ${
                    isActiveHref(item.href) ? "explore-item--active" : ""
                  }`}
                >
                  <ExploreEngraving
                    engraving={item.engraving}
                    shouldLoad={exploreOpen}
                  />
                  <span className="explore-item__body">
                    <span className="explore-item__name">{item.label}</span>
                    <span className="explore-item__desc">
                      {item.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="nav-dropdown">
        <Link
          href="/governance-evidence"
          className={`tab-nav nav-dropdown-trigger ${
            indexActive ? "tab-nav--active" : ""
          }`}
          style={{ textDecoration: "none" }}
        >
          Governance Evidence
          <ChevronDown
            className="nav-dropdown-chevron"
            aria-hidden="true"
            focusable="false"
          />
        </Link>
        <div className="nav-dropdown-menu" aria-label="Governance evidence and research sections">
          {INDEX_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-dropdown-item"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="nav-dropdown">
        <Link
          href="/methodology"
          className={`tab-nav nav-dropdown-trigger ${
            methodologyActive ? "tab-nav--active" : ""
          }`}
          style={{ textDecoration: "none" }}
        >
          Methodology
          <ChevronDown
            className="nav-dropdown-chevron"
            aria-hidden="true"
            focusable="false"
          />
        </Link>
        <div className="nav-dropdown-menu" aria-label="Methodology sections">
          {METHODOLOGY_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-dropdown-item"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {EDITORIAL_NAV_ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`tab-nav ${isActiveHref(href) ? "tab-nav--active" : ""}`}
          style={{ textDecoration: "none" }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
