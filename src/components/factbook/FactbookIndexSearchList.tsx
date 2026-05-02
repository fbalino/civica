"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";

interface FactbookIndexCountry {
  id: string | number;
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
}

export function FactbookIndexSearchList({
  countries,
}: {
  countries: ReadonlyArray<FactbookIndexCountry>;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((country) => {
      return (
        country.name.toLowerCase().includes(q) ||
        country.iso2?.toLowerCase().includes(q) ||
        country.iso3?.toLowerCase().includes(q)
      );
    });
  }, [countries, query]);

  return (
    <section className="factbook-index-search" aria-label="Search countries">
      <label className="factbook-index-search-label" htmlFor="factbook-index-search">
        Search countries
      </label>
      <div className="factbook-index-search-field">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l3.5 3.5" />
        </svg>
        <input
          id="factbook-index-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by country or code..."
          autoComplete="off"
        />
      </div>
      <p className="factbook-index-search-count" aria-live="polite">
        {filtered.length === countries.length
          ? `${countries.length} countries and territories`
          : `${filtered.length} matching ${filtered.length === 1 ? "country" : "countries"}`}
      </p>

      <ul className="factbook-index-grid">
        {filtered.map((country) => (
          <li key={country.id}>
            <Link href={`/factbook/${country.slug}`} className="factbook-index-card">
              <CountryFlag iso2={country.iso2} size={20} />
              <span>{country.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
