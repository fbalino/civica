"use client";

import { useMemo } from "react";
import { useActiveSection } from "@/hooks/useActiveSection";
import {
  FactbookCountrySearch,
  type FactbookCountryOption,
} from "@/components/factbook/FactbookCountrySearch";

export interface ReaderSidebarItem {
  id: string;
  label: string;
}

interface ReaderSidebarProps {
  items: ReadonlyArray<ReaderSidebarItem>;
  countries?: ReadonlyArray<FactbookCountryOption>;
  countryPathPrefix?: string;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  className?: string;
}

export function ReaderSidebar({
  items,
  countries = [],
  countryPathPrefix = "/country",
  searchPlaceholder = "Jump to country...",
  searchAriaLabel = "Jump to a country",
  className,
}: ReaderSidebarProps) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const active = useActiveSection(ids);

  return (
    <aside
      aria-label="Page sections"
      className={`reader-sidebar${className ? ` ${className}` : ""}`}
    >
      {countries.length > 0 ? (
        <FactbookCountrySearch
          countries={countries}
          placeholder={searchPlaceholder}
          countryPathPrefix={countryPathPrefix}
          ariaLabel={searchAriaLabel}
        />
      ) : null}
      <h3 className="reader-sidebar-title">On this page</h3>
      <ol className="reader-sidebar-list">
        {items.map((item, idx) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`reader-sidebar-link${isActive ? " is-active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(item.id);
                  if (!el) return;
                  const top =
                    el.getBoundingClientRect().top + window.scrollY - (56 + 16);
                  window.scrollTo({
                    top,
                    behavior: "instant" as ScrollBehavior,
                  });
                  history.replaceState(null, "", `#${item.id}`);
                }}
              >
                <span aria-hidden className="reader-sidebar-num">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="reader-sidebar-text">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
