"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";

interface Country {
  slug: string;
  name: string;
  iso2: string | null;
}

export interface SelectedCountryCard {
  slug: string;
  name: string;
  iso2: string | null;
  score: number | null;
  rank: number | null;
  governmentType: string | null;
  continent: string | null;
  populationLabel: string | null;
}

function countryFlag(iso2: string | null): string {
  if (!iso2) return "";
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function CountryPicker({
  countries,
  selected,
  selectedCard,
  onSelect,
  onRemove,
  placeholder,
  slotLabel,
  seriesColor,
}: {
  countries: Country[];
  selected: string | null;
  selectedCard?: SelectedCountryCard | null;
  onSelect: (slug: string) => void;
  onRemove: () => void;
  placeholder: string;
  slotLabel: string;
  seriesColor: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = query
    ? countries.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 12)
    : countries.slice(0, 12);

  const selectedCountry = selected ? countries.find((c) => c.slug === selected) : null;

  if (selectedCountry) {
    const meta = [
      selectedCard?.governmentType ?? null,
      selectedCard?.continent ?? null,
      selectedCard?.populationLabel ?? null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <div className="ci-compare-picker-card" style={{ borderTopColor: seriesColor }}>
        <div className="ci-compare-picker-slot">{slotLabel}</div>
        <div className="ci-compare-picker-name">
          <span style={{ fontSize: "var(--text-18)" }}>{countryFlag(selectedCountry.iso2)}</span>
          <span>{selectedCountry.name}</span>
        </div>
        <div className="ci-compare-picker-score">
          {selectedCard?.score !== null && selectedCard?.score !== undefined ? (
            <>
              <span className="ci-compare-picker-score-val" style={{ color: seriesColor }}>
                {selectedCard.score.toFixed(1)}
              </span>
              <span className="ci-compare-picker-score-label">
                CI{selectedCard.rank ? ` · rank ${selectedCard.rank}` : ""}
              </span>
            </>
          ) : (
            <span className="ci-compare-picker-score-label">No CI score</span>
          )}
        </div>
        <div className="ci-compare-picker-meta">{meta || "Profile data pending"}</div>
        <button
          onClick={onRemove}
          className="ci-compare-picker-remove"
          aria-label={`Remove ${selectedCountry.name}`}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="ci-compare-picker-card"
      style={{ position: "relative", borderTopColor: seriesColor }}
    >
      <div className="ci-compare-picker-slot">{slotLabel}</div>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="ci-compare-picker-search"
      />
      {open && filtered.length > 0 && (
        <div
          className="ci-compare-picker-menu"
          style={{
            position: "absolute",
            top: "100%",
            marginTop: 4,
            left: 0,
            right: 0,
            zIndex: 20,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-card-border)",
            background: "var(--color-surface-elevated)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {filtered.map((c) => (
            <button
              key={c.slug}
              onClick={() => { onSelect(c.slug); setQuery(""); setOpen(false); }}
              className="ci-compare-picker-option"
            >
              <span style={{ fontSize: "var(--text-18)" }}>{countryFlag(c.iso2)}</span>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {!open && (
        <div className="ci-compare-picker-empty">Select a country to compare</div>
      )}
    </div>
  );
}

export function CompareCountrySelector({
  countries,
  selectedCards,
}: {
  countries: Country[];
  selectedCards: Array<SelectedCountryCard | null>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.getAll("c");

  const updateUrl = useCallback(
    (slugs: string[]) => {
      const params = new URLSearchParams();
      slugs.forEach((s) => params.append("c", s));
      const nextUrl = params.toString() ? `/compare?${params.toString()}` : "/compare";
      router.replace(nextUrl, { scroll: false });
    },
    [router]
  );

  const slots: Array<string | null> = [
    current[0] ?? null,
    current[1] ?? null,
    current[2] ?? null,
  ];
  const slotLabels = ["Country A", "Country B", "Country C"];
  const seriesColors = [
    "var(--series-a)",
    "var(--series-b)",
    "var(--series-c)",
  ];

  return (
    <div className="compare-selector-grid">
      {slots.map((slug, i) => (
        <CountryPicker
          key={i}
          countries={countries.filter((c) => !current.includes(c.slug) || c.slug === slug)}
          selected={slug}
          selectedCard={selectedCards[i]}
          placeholder={
            i === 0
              ? "Select first country..."
              : i === 1
                ? "Select second country..."
                : "Add third (optional)..."
          }
          slotLabel={slotLabels[i]}
          seriesColor={seriesColors[i]}
          onSelect={(s) => {
            const next = [...slots];
            next[i] = s;
            updateUrl(next.filter((value): value is string => Boolean(value)));
          }}
          onRemove={() => {
            const next = [...slots];
            next[i] = null;
            updateUrl(next.filter((value): value is string => Boolean(value)));
          }}
        />
      ))}
    </div>
  );
}
