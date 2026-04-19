"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Country {
  slug: string;
  name: string;
  iso2: string | null;
  capital: string | null;
}

function countryFlag(iso2: string | null): string {
  if (!iso2) return "";
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function GlobalSearch({ countries }: { countries: Country[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [lastQuery, setLastQuery] = useState(query);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = query.length >= 1
    ? countries
        .filter(
          (c) =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.capital?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
    : [];

  if (lastQuery !== query) {
    setLastQuery(query);
    setSelectedIdx(0);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const navigate = useCallback(
    (slug: string) => {
      setQuery("");
      setOpen(false);
      router.push(`/countries/${slug}`);
    },
    [router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      navigate(filtered[selectedIdx].slug);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-card-border)",
          background: "var(--color-card-bg)",
          cursor: "text",
        }}
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ color: "var(--color-text-30)", flexShrink: 0 }}
        >
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open && filtered.length > 0}
          aria-controls="search-results"
          aria-autocomplete="list"
          aria-label="Search countries"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-primary)",
            width: 120,
          }}
        />
        <kbd
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-10)",
            color: "var(--color-text-20)",
            border: "1px solid var(--color-card-border)",
            borderRadius: 3,
            padding: "1px 4px",
            lineHeight: 1.4,
          }}
        >
          ⌘K
        </kbd>
      </div>

      {open && filtered.length > 0 && (
        <div
          id="search-results"
          role="listbox"
          aria-label="Search results"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            minWidth: 280,
            zIndex: 200,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-card-border)",
            background: "var(--color-surface-elevated)",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          }}
        >
          {filtered.map((c, i) => (
            <button
              key={c.slug}
              role="option"
              aria-selected={i === selectedIdx}
              onClick={() => navigate(c.slug)}
              onMouseEnter={() => setSelectedIdx(i)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: i === selectedIdx ? "var(--color-card-hover-bg)" : "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-primary)",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--color-divider)" : "none",
              }}
            >
              <span style={{ fontSize: "var(--text-18)", flexShrink: 0 }}>
                {countryFlag(c.iso2)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-14)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  {c.name}
                </div>
                {c.capital && (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-11)",
                      color: "var(--color-text-30)",
                      marginTop: 1,
                    }}
                  >
                    {c.capital}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
