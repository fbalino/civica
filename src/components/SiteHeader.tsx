"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { useAtlasHeader } from "@/context/AtlasHeaderContext";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";

export function SiteHeader({
  searchSlot,
  logoSlot,
  logoSlotSmall,
}: {
  searchSlot?: ReactNode;
  logoSlot?: ReactNode;
  logoSlotSmall?: ReactNode;
}) {
  const { atlasControls } = useAtlasHeader();

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
            }}
          >
            Civica
          </span>
          <span
            className="hidden sm:inline"
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-10)",
              color: "var(--color-text-30)",
              letterSpacing: "var(--tracking-caps)",
              textTransform: "uppercase",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            Atlas of governance
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
        {atlasControls ?? <NavLinks />}
      </div>

      {/* Right: ThemeToggle + Hamburger */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <ThemeToggle />
        <MobileNav searchSlot={searchSlot} logoSlot={logoSlotSmall} />
      </div>
    </nav>
  );
}
