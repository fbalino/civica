"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/countries", label: "Index" },
  { href: "/compare", label: "Compare" },
  { href: "/rankings", label: "Rankings" },
  { href: "/blog", label: "Blog" },
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
          <a
            key={href}
            href={href}
            className={`tab-nav ${isActive ? "tab-nav--active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
