"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/countries", label: "Index" },
  { href: "/elections", label: "Elections" },
  { href: "/government-types", label: "Gov Types" },
  { href: "/compare", label: "Compare" },
  { href: "/about", label: "About" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {LINKS.map(({ href, label }) => {
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
