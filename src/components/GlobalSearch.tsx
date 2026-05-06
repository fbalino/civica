"use client";

import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";

interface Country {
  slug: string;
  name: string;
  iso2: string | null;
  capital: string | null;
}

export function GlobalSearch({ countries }: { countries: Country[] }) {
  return (
    <CountrySearchCombobox
      countries={countries}
      countryPathPrefix="/countries"
      placeholder="Search countries..."
      ariaLabel="Search countries"
      showShortcut
      enableShortcut
      compact
    />
  );
}
