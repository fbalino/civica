"use client";

import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";

interface Country {
  slug: string;
  name: string;
  iso2: string | null;
  capital: string | null;
  status: import("@/lib/jurisdictions/status-presentation").JurisdictionStatusPresentation;
}

export function GlobalSearch({ countries }: { countries: Country[] }) {
  return (
    <CountrySearchCombobox
      countries={countries}
      countryPathPrefix="/country"
      placeholder="Search countries and areas..."
      ariaLabel="Search countries and areas"
      showShortcut
      enableShortcut
      compact
    />
  );
}
