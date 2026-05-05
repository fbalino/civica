"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { INDEX_NAV_ITEMS } from "@/components/indexNavItems";
import { METHODOLOGY_NAV_ITEMS } from "@/components/methodologyNavItems";

const LEADING_LINKS = [
  { href: "/factbook", label: "Factbook" },
  { href: "/atlas", label: "Atlas" },
];

const TRAILING_LINKS = [
  { href: "/blog", label: "The Record" },
  { href: "/about", label: "About" },
];

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
    // and /factbook/methodology — treat them as Methodology-active too.
    pathname.startsWith("/civica-index/methodology") ||
    pathname.startsWith("/factbook/methodology");

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {LEADING_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`tab-nav ${isActiveHref(href) ? "tab-nav--active" : ""}`}
          style={{ textDecoration: "none" }}
        >
          {label}
        </Link>
      ))}

      <div className="nav-dropdown">
        <Link
          href="/civica-index"
          className={`tab-nav nav-dropdown-trigger ${
            indexActive ? "tab-nav--active" : ""
          }`}
          style={{ textDecoration: "none" }}
        >
          Index
          <ChevronDown
            className="nav-dropdown-chevron"
            aria-hidden="true"
            focusable="false"
          />
        </Link>
        <div className="nav-dropdown-menu" aria-label="Index sections">
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
