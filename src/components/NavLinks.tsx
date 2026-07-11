"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { INDEX_NAV_ITEMS } from "@/components/indexNavItems";
import { METHODOLOGY_NAV_ITEMS } from "@/components/methodologyNavItems";
import { EXPLORE_NAV_GROUPS } from "@/components/exploreNavItems";

/** All hrefs that live under the "Explore" megamenu — used to light the
 * trigger active when the reader is on any of the eight browse surfaces. */
const EXPLORE_HREFS = EXPLORE_NAV_GROUPS.flatMap((g) =>
  g.items.map((i) => i.href),
);

const TRAILING_LINKS = [
  { href: "/blog", label: "The Record" },
  { href: "/about", label: "About" },
];

/** A spot engraving with its dark-mode counterpart; the site-wide
 * `theme-engraving-*` classes swap them by theme. */
function ExploreEngraving({ engraving }: { engraving: string }) {
  return (
    <span className="explore-item__engraving" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="theme-engraving-light"
        src={`/engravings/spot-${engraving}.webp`}
        alt=""
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="theme-engraving-dark"
        src={`/engravings/spot-${engraving}-dark.webp`}
        alt=""
      />
    </span>
  );
}

export function NavLinks() {
  const pathname = usePathname();

  const isActiveHref = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  const indexActive =
    pathname === "/civica-index" || pathname.startsWith("/civica-index/");

  const methodologyActive =
    pathname === "/methodology" ||
    pathname.startsWith("/methodology/") ||
    // Methodology pages physically live under /civica-index/methodology
    // and /country/methodology — treat them as Methodology-active too.
    pathname.startsWith("/civica-index/methodology") ||
    pathname.startsWith("/country/methodology");

  // Exclude the Methodology surfaces: they physically live under
  // `/country/methodology`, whose `/country` prefix would otherwise light
  // BOTH the Explore trigger and the Methodology trigger on the same page.
  // Methodology wins that overlap — the reader is reading methodology, not
  // browsing a country.
  const exploreActive =
    !methodologyActive && EXPLORE_HREFS.some((href) => isActiveHref(href));

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
        onMouseLeave={closeExploreSoon}
        onFocus={openExplore}
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
          onClick={() => setExploreOpen((v) => !v)}
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
                  <ExploreEngraving engraving={item.engraving} />
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
          href="/civica-index"
          className={`tab-nav nav-dropdown-trigger ${
            indexActive ? "tab-nav--active" : ""
          }`}
          style={{ textDecoration: "none" }}
        >
          Index · Beta
          <ChevronDown
            className="nav-dropdown-chevron"
            aria-hidden="true"
            focusable="false"
          />
        </Link>
        <div className="nav-dropdown-menu" aria-label="Research-beta Index sections">
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

      {TRAILING_LINKS.map(({ href, label }) => (
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
