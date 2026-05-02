"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/factbook", label: "Factbook" },
  { href: "/atlas", label: "Atlas" },
  { href: "/blog", label: "The Record" },
  { href: "/about", label: "About" },
];

const INDEX_LINKS = [
  { href: "/civica-index", label: "Overview" },
  { href: "/civica-index/methodology", label: "Methodology" },
  { href: "/civica-index/pulse-changelog", label: "Pulse changelog" },
  { href: "/civica-index/methodology/pulse", label: "Pulse methodology" },
  { href: "/civica-index/government-types", label: "Government types" },
  { href: "/civica-index/corrections", label: "Corrections" },
  { href: "/civica-index/replication", label: "Replication" },
  { href: "/civica-index/widget", label: "Widgets" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {LINKS.slice(0, 2).map(({ href, label }) => {
        const isActive =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`tab-nav ${isActive ? "tab-nav--active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {label}
          </Link>
        );
      })}
      <div className="nav-dropdown">
        <Link
          href="/civica-index"
          className={`tab-nav nav-dropdown-trigger ${
            pathname === "/civica-index" || pathname.startsWith("/civica-index/")
              ? "tab-nav--active"
              : ""
          }`}
          style={{ textDecoration: "none" }}
        >
          Index
          <span className="nav-dropdown-chevron" aria-hidden="true">
            ▾
          </span>
        </Link>
        <div className="nav-dropdown-menu" aria-label="Index sections">
          {INDEX_LINKS.map((item) => (
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
      {LINKS.slice(2).map(({ href, label }) => {
        const isActive =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`tab-nav ${isActive ? "tab-nav--active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
