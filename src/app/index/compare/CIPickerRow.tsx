"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export type CountryListItem = {
  slug: string;
  name: string;
  iso2: string | null;
  governmentType: string | null;
  continent: string | null;
  population: number | null;
};

export type SlotData = {
  slug: string;
  name: string;
  score: number | null;
  rank: number | null;
  quarter: string | null;
  governmentType: string | null;
  continent: string | null;
  population: number | null;
} | null;

const SLOT_LABELS = ["Country A", "Country B", "Country C"] as const;

const SLOT_COLORS = [
  "var(--series-a)",
  "var(--series-b)",
  "var(--series-c)",
] as const;

const VAL_COLORS = [
  "var(--series-a)",
  "var(--series-b)",
  "var(--series-c)",
] as const;

function countryFlag(iso2: string | null): string {
  if (!iso2) return "";
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function formatPop(pop: number | null): string {
  if (!pop) return "";
  if (pop >= 1_000_000_000) return `${(pop / 1_000_000_000).toFixed(1)}B`;
  if (pop >= 1_000_000) return `${Math.round(pop / 1_000_000)}M`;
  return `${Math.round(pop / 1_000)}K`;
}

function SearchDropdown({
  countries,
  selectedSlugs,
  onSelect,
}: {
  countries: CountryListItem[];
  selectedSlugs: string[];
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const available = countries.filter((c) => !selectedSlugs.includes(c.slug));
  const filtered = query
    ? available.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : available.slice(0, 6);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        type="text"
        placeholder="Search a country…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={{
          width: "100%",
          background: "var(--color-bg)",
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-card-border)",
          borderRadius: 4,
          padding: "10px 12px",
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 13,
          boxSizing: "border-box",
        }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            marginTop: 4,
            left: 0,
            right: 0,
            zIndex: 30,
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-card-border)",
            borderRadius: 4,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {filtered.map((c) => (
            <button
              key={c.slug}
              onClick={() => { onSelect(c.slug); setQuery(""); setOpen(false); }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "9px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 16 }}>{countryFlag(c.iso2)}</span>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CIPickerRow({
  countryList,
  slots,
  selectedA,
  selectedB,
  selectedC,
}: {
  countryList: CountryListItem[];
  slots: [SlotData, SlotData, SlotData];
  selectedA: string | null;
  selectedB: string | null;
  selectedC: string | null;
}) {
  const router = useRouter();
  const selectedSlugs = [selectedA, selectedB, selectedC].filter(Boolean) as string[];

  const updateUrl = (a: string | null, b: string | null, c: string | null) => {
    const params = new URLSearchParams();
    if (a) params.set("a", a);
    if (b) params.set("b", b);
    if (c) params.set("c", c);
    router.push(`/index/compare?${params.toString()}`);
  };

  const current: [string | null, string | null, string | null] = [selectedA, selectedB, selectedC];

  const handleSelect = (i: number, slug: string) => {
    const next = [...current] as [string | null, string | null, string | null];
    next[i] = slug;
    updateUrl(next[0], next[1], next[2]);
  };

  const handleRemove = (i: number) => {
    const next = [...current] as [string | null, string | null, string | null];
    next[i] = null;
    updateUrl(next[0], next[1], next[2]);
  };

  return (
    <div
      className="ci-compare-picker"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
        margin: "40px 0 24px",
      }}
      aria-label="Country slots"
    >
      {slots.map((slot, i) => (
        <div
          key={i}
          style={{
            background: "var(--color-grid-cell)",
            border: "1px solid var(--color-card-border)",
            borderTop: `3px solid ${SLOT_COLORS[i]}`,
            borderRadius: 4,
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Slot label */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--color-text-30)",
            }}
          >
            {SLOT_LABELS[i]}
          </div>

          {slot ? (
            <>
              {/* Country name */}
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 28,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {slot.name}
              </div>

              {/* Score row */}
              {slot.score !== null && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: "var(--font-heading)" }}>
                  <span
                    style={{
                      fontSize: 32,
                      fontWeight: 500,
                      letterSpacing: "-0.02em",
                      color: VAL_COLORS[i],
                    }}
                  >
                    {slot.score.toFixed(1)}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--color-text-30)",
                    }}
                  >
                    CI{slot.rank ? ` · rank ${slot.rank}` : ""}
                  </span>
                </div>
              )}

              {/* Meta */}
              {(slot.governmentType || slot.continent || slot.population) && (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    fontSize: 11,
                    color: "var(--color-text-30)",
                  }}
                >
                  {[
                    slot.governmentType,
                    slot.continent,
                    slot.population ? formatPop(slot.population) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={() => handleRemove(i)}
                style={{
                  marginTop: 4,
                  background: "transparent",
                  border: "1px solid var(--color-card-border)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-text-40)",
                  padding: "6px 10px",
                  borderRadius: 2,
                  cursor: "pointer",
                  width: "fit-content",
                }}
              >
                × Remove
              </button>
            </>
          ) : (
            <SearchDropdown
              countries={countryList}
              selectedSlugs={selectedSlugs}
              onSelect={(slug) => handleSelect(i, slug)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
