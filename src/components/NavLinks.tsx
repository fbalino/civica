"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/countries", label: "Countries" },
  { href: "/rankings", label: "Rankings" },
  { href: "/about", label: "About" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-6">
      {LINKS.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <a
            key={href}
            href={href}
            className={`text-sm transition-colors ${
              isActive
                ? "text-[var(--color-text-primary)] font-medium"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
