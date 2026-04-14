"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/countries", label: "Index" },
  { href: "/compare", label: "Compare" },
  { href: "/rankings", label: "Rankings" },
  { href: "/about", label: "About" },
];

export function MobileNav({ searchSlot }: { searchSlot?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
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
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            top: 56,
            zIndex: 30,
            background: "var(--color-bg)",
            padding: 24,
          }}
        >
          {searchSlot && (
            <div style={{ marginBottom: 20 }}>
              {searchSlot}
            </div>
          )}
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <a
                  key={href}
                  href={href}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md)",
                    textDecoration: "none",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-14)",
                    color: isActive ? "var(--color-text-primary)" : "var(--color-text-40)",
                    background: isActive ? "var(--color-card-bg)" : "transparent",
                  }}
                >
                  {label}
                </a>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
