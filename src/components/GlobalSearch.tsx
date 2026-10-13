"use client";

import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";

// Searches the shared site-wide jurisdiction directory, fetched once on first
// use (src/lib/jurisdictions/use-jurisdiction-directory.ts).
export function GlobalSearch() {
  return (
    <CountrySearchCombobox
      countryPathPrefix="/country"
      placeholder="Search countries and areas..."
      ariaLabel="Search countries and areas"
      showShortcut
      enableShortcut
      compact
    />
  );
}
