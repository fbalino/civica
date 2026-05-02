"use client";

import { useMemo } from "react";
import { useActiveSection } from "@/hooks/useActiveSection";

export interface FactbookSidebarItem {
  id: string;
  label: string;
}

interface FactbookSidebarProps {
  items: ReadonlyArray<FactbookSidebarItem>;
}

// Layout (sticky, max-height, mobile collapse) lives in
// src/app/factbook.css under `.factbook-sidebar` so @media queries can
// override it. Inline styles only carry component-local typography.
export function FactbookSidebar({ items }: FactbookSidebarProps) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const active = useActiveSection(ids);

  return (
    <aside aria-label="Page sections" className="factbook-sidebar">
      <h3
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-10)",
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-wider)",
          color: "var(--color-text-40)",
          margin: "0 0 var(--space-4)",
          fontWeight: 400,
        }}
      >
        On this page
      </h3>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item, idx) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`factbook-sidebar-link${isActive ? " is-active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(item.id);
                  if (!el) return;
                  const top =
                    el.getBoundingClientRect().top +
                    window.scrollY -
                    (56 + 16);
                  window.scrollTo({
                    top,
                    behavior: "instant" as ScrollBehavior,
                  });
                  history.replaceState(null, "", `#${item.id}`);
                }}
              >
                <span aria-hidden className="factbook-sidebar-num">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                {item.label}
              </a>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
