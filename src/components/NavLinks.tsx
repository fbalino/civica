"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { INDEX_NAV_GROUPS } from "@/components/indexNavItems";

const LINKS = [
  { href: "/factbook", label: "Factbook" },
  { href: "/atlas", label: "Atlas" },
  { href: "/blog", label: "The Record" },
  { href: "/about", label: "About" },
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
          <ChevronDown
            className="nav-dropdown-chevron"
            aria-hidden="true"
            focusable="false"
          />
        </Link>
        <div className="nav-dropdown-menu" aria-label="Index sections">
          {INDEX_NAV_GROUPS.map((group) => (
            <div className="nav-dropdown-group" key={group.label}>
              <div className="nav-dropdown-group-label">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-dropdown-item"
                >
                  {item.label}
                </Link>
              ))}
            </div>
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
