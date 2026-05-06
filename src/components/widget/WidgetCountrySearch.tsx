"use client";

import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";
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
  const active = currentSlug
    ? countries.find((c) => c.slug === currentSlug)
    : null;

  return (
    <div className="widget-search">
      <label className="widget-search-label">Pick a country</label>
      <CountrySearchCombobox
        countries={countries.map((country) => ({
          slug: country.slug,
          name: country.name,
          iso2: country.iso2 ?? null,
          iso3: country.iso3,
          capital: country.capital,
        }))}
        compact
        placeholder={
          active ? `Search — currently ${active.name}` : "Search any country..."
        }
        ariaLabel="Pick a country"
        hrefForCountry={(country) =>
          buildHref(country.slug, currentTheme, currentDims)
        }
      />
    </div>
  );
}
