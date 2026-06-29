import Link from "next/link";
import { type ReactNode } from "react";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/editorial/Button";

export function SiteHeader({
  searchSlot,
  logoSlot,
  logoSlotSmall,
}: {
  searchSlot?: ReactNode;
  logoSlot?: ReactNode;
  logoSlotSmall?: ReactNode;
}) {
  return (
    <nav
      id="site-header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--spacing-page-x)",
        height: 56,
        borderBottom: "1px solid var(--color-divider)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "var(--color-bg-nav)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Left: Logo */}
      <Link
        href="/"
        style={{
          cursor: "pointer",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {logoSlot}
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-24)",
              fontWeight: 300,
              letterSpacing: "var(--tracking-tighter)",
              color: "var(--color-text-primary)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            Civica Atlas
          </span>
        </span>
      </Link>

      {/* Center: Atlas controls or NavLinks */}
      <div
        className="hidden md:flex"
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          minWidth: 0,
          padding: "0 16px",
        }}
      >
        <NavLinks />
      </div>

      {/* Right: Theme toggle + Explore CTA (desktop) + hamburger (mobile) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <ThemeToggle />
        {/* Primary CTA — desktop only; mobile users get the hamburger menu instead.
            Uses a dedicated class (not Tailwind `hidden`) because `.btn`'s own
            `display` is unlayered and would override a layered utility. */}
        <Button variant="primary" arrow href="/factbook" className="site-header__cta">
          Explore Countries
        </Button>
        <MobileNav searchSlot={searchSlot} logoSlot={logoSlotSmall} />
      </div>
    </nav>
  );
}
