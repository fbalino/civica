"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";

interface Country {
  slug: string;
  name: string;
  iso2: string | null;
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
  onSelect,
  onRemove,
  placeholder,
}: {
  countries: Country[];
  selected: string | null;
  onSelect: (slug: string) => void;
  onRemove: () => void;
  placeholder: string;
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
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-card-border)",
          background: "var(--color-card-bg)",
        }}
      >
        <span style={{ fontSize: "var(--text-18)" }}>{countryFlag(selectedCountry.iso2)}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-13)", color: "var(--color-text-primary)", flex: 1 }}>
          {selectedCountry.name}
        </span>
        <button
          onClick={onRemove}
          style={{ color: "var(--color-text-30)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
          aria-label="Remove"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 4l6 6M10 4l-6 6" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-13)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-card-border)",
          background: "var(--color-select-bg)",
          color: "var(--color-text-primary)",
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
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-13)",
              }}
            >
              <span style={{ fontSize: "var(--text-18)" }}>{countryFlag(c.iso2)}</span>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CompareSelector({ countries }: { countries: Country[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.getAll("c");

  const updateUrl = useCallback(
    (slugs: string[]) => {
      const params = new URLSearchParams();
      slugs.forEach((s) => params.append("c", s));
      router.push(`/compare?${params.toString()}`);
    },
    [router]
  );

  const slots = [current[0] ?? null, current[1] ?? null, current[2] ?? null];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 40 }}>
      {slots.map((slug, i) => (
        <CountryPicker
          key={i}
          countries={countries.filter((c) => !current.includes(c.slug) || c.slug === slug)}
          selected={slug}
          placeholder={i === 0 ? "Select first country..." : i === 1 ? "Select second country..." : "Add third (optional)..."}
          onSelect={(s) => {
            const next = [...current];
            if (next.length <= i) next.push(s);
            else next[i] = s;
            updateUrl(next);
          }}
          onRemove={() => {
            const next = current.filter((_, j) => j !== i);
            updateUrl(next);
          }}
        />
      ))}
    </div>
  );
}
