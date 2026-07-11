"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";
import { CountryFlag } from "@/components/CountryFlag";

interface Country {
  slug: string;
  name: string;
  iso2: string | null;
}

export interface SelectedCountryCard {
  slug: string;
  name: string;
  iso2: string | null;
  governmentType: string | null;
  continent: string | null;
  populationLabel: string | null;
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
          <CountryFlag iso2={selectedCountry.iso2} size={20} />
          <span>{selectedCountry.name}</span>
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
      className="ci-compare-picker-card"
      style={{ borderTopColor: seriesColor }}
    >
      <div className="ci-compare-picker-slot">{slotLabel}</div>
      <CountrySearchCombobox
        countries={countries}
        placeholder={placeholder}
        ariaLabel={placeholder}
        compact
        onSelect={(country) => onSelect(country.slug)}
      />
      <div className="ci-compare-picker-empty">Select a country to compare</div>
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
