"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/countries", label: "Index" },
  { href: "/compare", label: "Compare" },
  { href: "/rankings", label: "Rankings" },
  { href: "/about", label: "About" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5">
      {LINKS.map(({ href, label }) => {
        const isActive =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <a
            key={href}
            href={href}
            className={`tab-nav no-underline ${isActive ? "tab-nav--active" : ""}`}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
