"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const SUGGESTIONS: Array<{ name: string; slug: string }> = [
  { name: "France", slug: "france" },
  { name: "Germany", slug: "germany" },
  { name: "Japan", slug: "japan" },
  { name: "United Kingdom", slug: "united-kingdom" },
  { name: "Brazil", slug: "brazil" },
  { name: "Canada", slug: "canada" },
  { name: "Mexico", slug: "mexico" },
  { name: "China", slug: "china" },
  { name: "India", slug: "india" },
  { name: "Russia", slug: "russia" },
  { name: "Australia", slug: "australia" },
  { name: "South Korea", slug: "south-korea" },
];

/**
 * Small typeahead used in the country masthead's column 5 — type a
 * country name, pick from the suggestions, navigate to
 * /compare?c=<self>&c=<picked>. Hardcoded suggestion list (not a full
 * country API) because Phase A is mockup-grade. The /compare page
 * itself handles unknown slugs gracefully.
 */
export function QuickCompareSearch({ currentSlug }: { currentSlug: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const results = useMemo(() => {
    const pool = SUGGESTIONS.filter((s) => s.slug !== currentSlug);
    if (!query.trim()) return pool.slice(0, 5);
    const q = query.trim().toLowerCase();
    return pool.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 5);
  }, [query, currentSlug]);

  const commit = (slug: string) => {
    setQuery("");
    setFocused(false);
    router.push(`/compare?c=${currentSlug}&c=${slug}`);
  };

  return (
    <div className="cm-qc-search">
      <input
        type="search"
        autoComplete="off"
        placeholder="Compare with…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIdx(0);
          setFocused(true);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
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
      {focused && results.length > 0 && (
        <ul className="cm-qc-results" role="listbox">
          {results.map((c, i) => (
            <li
              key={c.slug}
              role="option"
              aria-selected={i === activeIdx}
              className={i === activeIdx ? "on" : ""}
              onMouseDown={() => commit(c.slug)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
