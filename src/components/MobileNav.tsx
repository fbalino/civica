"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Map" },
  { href: "/countries", label: "Index" },
  { href: "/rankings", label: "Rankings" },
  { href: "/about", label: "About" },
];

export function MobileNav() {
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
        className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)] transition-colors"
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
        <div className="fixed inset-0 top-14 z-30 bg-[var(--color-surface)] p-6">
          <nav className="flex flex-col gap-1">
            {LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <a
                  key={href}
                  href={href}
                  className={`py-3 px-4 rounded-[var(--radius-md)] text-base transition-colors no-underline ${
                    isActive
                      ? "text-[var(--color-text-primary)] font-medium bg-[var(--color-surface-alt)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)]"
                  }`}
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
