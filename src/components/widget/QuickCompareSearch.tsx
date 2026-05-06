"use client";

import { useRouter } from "next/navigation";
import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";

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

export function QuickCompareSearch({ currentSlug }: { currentSlug: string }) {
  const router = useRouter();
  const countries = SUGGESTIONS.filter((s) => s.slug !== currentSlug).map(
    (country) => ({
      ...country,
      iso2: null,
      iso3: null,
    })
  );

  return (
    <CountrySearchCombobox
      countries={countries}
      compact
      placeholder="Compare with..."
      ariaLabel="Compare with another country"
      onSelect={(country) =>
        router.push(`/compare?c=${currentSlug}&c=${country.slug}`)
      }
      className="cm-qc-search"
    />
  );
}
