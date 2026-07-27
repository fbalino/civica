"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { INDEX_NAV_ITEMS } from "@/components/indexNavItems";
import { METHODOLOGY_NAV_ITEMS } from "@/components/methodologyNavItems";
import { EXPLORE_NAV_GROUPS } from "@/components/exploreNavItems";
import { ExploreMenuPanel } from "@/components/ExploreMenuPanel";
import { EDITORIAL_NAV_ITEMS } from "@/components/editorialNavItems";
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
  const suppressFocusOpen = useRef(false);

  const openExplore = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    suppressFocusOpen.current = false;
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
        className="nav-dropdown nav-dropdown--explore"
        onMouseEnter={openExplore}
        onFocus={(event) => {
          if (suppressFocusOpen.current) {
            suppressFocusOpen.current = false;
            return;
          }
          if (event.currentTarget.contains(event.target)) openExplore();
        }}
        onMouseLeave={closeExploreSoon}
        onBlur={(e) => {
          // Close only when focus leaves the whole dropdown (trigger + panel).
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            suppressFocusOpen.current = false;
            setExploreOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && exploreOpen) {
            e.preventDefault();
            suppressFocusOpen.current = true;
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
          aria-expanded={exploreOpen}
          aria-controls="explore-navigation-panel"
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
        {exploreOpen ? (
          <div
            id="explore-navigation-panel"
            className="nav-dropdown-menu explore-menu explore-menu--open"
            aria-label="Explore Civica Atlas"
          >
            <ExploreMenuPanel
              shouldLoadArt
              groups={EXPLORE_NAV_GROUPS}
              isActiveHref={isActiveHref}
              onNavigate={() => setExploreOpen(false)}
            />
          </div>
        ) : null}
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
