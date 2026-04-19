"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  descriptor: string;
  glyph: string;
};

const PRIMARY: NavItem[] = [
  { href: "/", label: "Home", descriptor: "Today in governance", glyph: "◐" },
  { href: "/countries", label: "Countries", descriptor: "Index of 250+ nations", glyph: "◯" },
  { href: "/elections", label: "Elections", descriptor: "Upcoming & historical", glyph: "▲" },
  { href: "/government-types", label: "Gov Types", descriptor: "Systems compared", glyph: "▣" },
  { href: "/compare", label: "Compare", descriptor: "Side-by-side analysis", glyph: "⇆" },
  { href: "/rankings", label: "Rankings", descriptor: "Data-backed leaderboards", glyph: "☰" },
  { href: "/blog", label: "Blog", descriptor: "Essays & visualizations", glyph: "✎" },
];

const REFERENCE: NavItem[] = [
  { href: "/about", label: "About", descriptor: "Mission & methodology", glyph: "ⓘ" },
  { href: "/about#sources", label: "Sources", descriptor: "Data provenance", glyph: "✦" },
  { href: "/api-docs", label: "API", descriptor: "Developer reference", glyph: "{ }" },
  { href: "/contact", label: "Contact", descriptor: "Get in touch with the editors", glyph: "✉" },
];

const LEGAL: NavItem[] = [
  { href: "/privacy", label: "Privacy", descriptor: "How we handle data", glyph: "⊙" },
  { href: "/terms", label: "Terms", descriptor: "Usage & licensing", glyph: "§" },
];

function useIsActive(pathname: string) {
  return (href: string) => {
    const path = href.split("#")[0];
    if (!path) return false;
    return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");
  };
}

export function MobileNav({ searchSlot, logoSlot }: { searchSlot?: ReactNode; logoSlot?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: "var(--radius-md)",
          color: "var(--color-text-40)",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 4h12M2 8h12M2 12h12" />
          </svg>
        )}
      </button>

      {mounted && open && createPortal(
        <MenuOverlay onClose={() => setOpen(false)} pathname={pathname} searchSlot={searchSlot} logoSlot={logoSlot} />,
        document.body
      )}
    </>
  );
}

function MenuOverlay({
  onClose,
  pathname,
  searchSlot,
  logoSlot,
}: {
  onClose: () => void;
  pathname: string;
  searchSlot?: ReactNode;
  logoSlot?: ReactNode;
}) {
  const isActive = useIsActive(pathname);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Main menu"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "var(--color-bg)",
        animation: "civ-slide-right 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <OverlayHeader onClose={onClose} logoSlot={logoSlot} />

      <div style={{ padding: "4px 20px 18px", borderBottom: "1px solid var(--color-divider)" }}>
        {searchSlot}
      </div>

      <div style={{ padding: "22px 20px 8px" }}>
        <Eyebrow>The Atlas</Eyebrow>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 10 }}>
          {PRIMARY.map((item, i) => (
            <PanelRow key={item.href} item={item} active={isActive(item.href)} delay={i * 22} />
          ))}
        </nav>
      </div>

      <div style={{ padding: "20px 20px 8px" }}>
        <Eyebrow>Reference</Eyebrow>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 10 }}>
          {REFERENCE.map((item, i) => (
            <PanelRow key={item.href} item={item} active={isActive(item.href)} delay={(PRIMARY.length + i) * 22} />
          ))}
        </nav>
      </div>

      <div style={{ padding: "20px 20px 8px" }}>
        <Eyebrow>Legal</Eyebrow>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 10 }}>
          {LEGAL.map((item, i) => (
            <PanelRow
              key={item.href}
              item={item}
              active={isActive(item.href)}
              delay={(PRIMARY.length + REFERENCE.length + i) * 22}
            />
          ))}
        </nav>
      </div>

      <OverlayFooter />
    </div>
  );
}

function PanelRow({ item, active, delay = 0 }: { item: NavItem; active: boolean; delay?: number }) {
  return (
    <Link
      href={item.href}
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr auto",
        alignItems: "center",
        gap: 14,
        padding: "12px 12px",
        borderRadius: "var(--radius-md)",
        textDecoration: "none",
        background: active ? "var(--color-card-bg)" : "transparent",
        border: `1px solid ${active ? "var(--color-card-border)" : "transparent"}`,
        animation: `civ-slide-up 320ms ${delay}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-14)",
          color: active ? "var(--color-accent)" : "var(--color-text-30)",
          textAlign: "center",
        }}
      >
        {item.glyph}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-16)",
            fontWeight: 500,
            color: active ? "var(--color-accent)" : "var(--color-text-primary)",
            lineHeight: 1.2,
          }}
        >
          {item.label}
        </span>
        <span
          style={{
            display: "block",
            marginTop: 2,
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-11)",
            color: "var(--color-text-30)",
          }}
        >
          {item.descriptor}
        </span>
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-25)",
        }}
      >
        →
      </span>
    </Link>
  );
}

function OverlayHeader({ onClose, logoSlot }: { onClose: () => void; logoSlot?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px",
        borderBottom: "1px solid var(--color-divider)",
        minHeight: 56,
        position: "sticky",
        top: 0,
        background: "var(--color-bg)",
        zIndex: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {logoSlot}
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-22)",
            letterSpacing: "var(--tracking-tighter)",
            color: "var(--color-text-primary)",
          }}
        >
          Civica
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-10)",
            letterSpacing: "var(--tracking-caps)",
            color: "var(--color-text-30)",
            textTransform: "uppercase",
          }}
        >
          Menu
        </span>
      </div>
      <button
        onClick={onClose}
        aria-label="Close menu"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: "var(--radius-md)",
          background: "none",
          border: "1px solid var(--color-card-border)",
          color: "var(--color-text-40)",
          cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--font-weight-mono)",
        fontSize: "var(--text-10)",
        letterSpacing: "var(--tracking-caps)",
        color: "var(--color-text-30)",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function OverlayFooter() {
  return (
    <div
      style={{
        marginTop: 24,
        padding: "20px 20px 32px",
        borderTop: "1px solid var(--color-divider)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <SystemStatus />

      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <LegendDot color="var(--color-source-live)" label="Live" />
        <LegendDot color="var(--color-source-frozen)" label="Archived (Jan 2026)" />
      </div>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-11)",
          color: "var(--color-text-30)",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Data from Wikidata (CC0), IPU Parline, Constitute Project, and the CIA World Factbook (archived).
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          paddingTop: 14,
          borderTop: "1px solid var(--color-divider)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-10)",
            color: "var(--color-text-25)",
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
          }}
        >
          Atlas of governance
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-10)",
            color: "var(--color-text-25)",
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
          }}
        >
          © {new Date().getFullYear()} Civica
        </span>
      </div>
    </div>
  );
}

function SystemStatus() {
  return (
    <Link
      href="/about#status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-card-border)",
        background: "var(--color-card-bg)",
        textDecoration: "none",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            position: "relative",
            width: 10,
            height: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "var(--color-source-live)",
              opacity: 0.4,
              animation: "civ-pulse 2s ease-out infinite",
            }}
          />
          <span
            style={{
              position: "relative",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--color-source-live)",
            }}
          />
        </span>
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-14)",
              fontWeight: 500,
              color: "var(--color-text-primary)",
              lineHeight: 1.2,
            }}
          >
            All systems operational
          </span>
          <span
            style={{
              marginTop: 2,
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-10)",
              color: "var(--color-text-30)",
              letterSpacing: "var(--tracking-wide)",
            }}
          >
            Data pipeline · API · Search
          </span>
        </span>
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-10)",
          letterSpacing: "var(--tracking-caps)",
          color: "var(--color-text-25)",
          textTransform: "uppercase",
        }}
      >
        Status
      </span>
    </Link>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--font-weight-mono)",
        fontSize: "var(--text-10)",
        color: "var(--color-text-30)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
        }}
      />
      {label}
    </span>
  );
}
