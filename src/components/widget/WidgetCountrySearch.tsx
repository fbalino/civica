"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AtlasCountry } from "@/lib/atlas/load-atlas-data";

interface Props {
  countries: AtlasCountry[];
  currentSlug: string | null;
  currentTheme: "auto" | "light" | "dark";
  currentDims: boolean;
}

function buildHref(
  slug: string,
  theme: Props["currentTheme"],
  dims: boolean
): string {
  const qs = new URLSearchParams({ c: slug });
  if (theme !== "auto") qs.set("theme", theme);
  if (dims) qs.set("dims", "1");
  return `/civica-index/widget?${qs.toString()}`;
}

export function WidgetCountrySearch({
  countries,
  currentSlug,
  currentTheme,
  currentDims,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const active = currentSlug
    ? countries.find((c) => c.slug === currentSlug)
    : null;

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return countries
      .filter((c) => {
        const name = c.name.toLowerCase();
        const iso = (c.iso3 ?? "").toLowerCase();
        return name.includes(q) || iso === q || iso.startsWith(q);
      })
      .slice(0, 8);
  }, [countries, query]);

  const commit = useCallback(
    (slug: string) => {
      setQuery("");
      setFocused(false);
      router.push(buildHref(slug, currentTheme, currentDims));
    },
    [router, currentTheme, currentDims]
  );

  return (
    <div className="widget-search">
      <label className="widget-search-label" htmlFor="widget-country-search">
        Pick a country
      </label>
      <div className="widget-search-row">
        <input
          id="widget-country-search"
          ref={inputRef}
          type="search"
          autoComplete="off"
          placeholder={
            active ? `Search — currently ${active.name}` : "Search any country…"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(0);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so a click on a result can register before blur hides it.
            setTimeout(() => setFocused(false), 140);
          }}
          onKeyDown={(e) => {
            if (results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = results[activeIdx];
              if (pick) commit(pick.slug);
            } else if (e.key === "Escape") {
              setQuery("");
              setFocused(false);
            }
          }}
        />
      </div>
      {focused && results.length > 0 && (
        <ul className="widget-search-results" role="listbox">
          {results.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === activeIdx}
              className={i === activeIdx ? "on" : ""}
              onMouseDown={() => commit(c.slug)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="widget-search-name">{c.name}</span>
              {c.iso3 ? (
                <span className="widget-search-iso">{c.iso3}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
