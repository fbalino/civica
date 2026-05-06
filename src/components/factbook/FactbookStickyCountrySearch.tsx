"use client";

import { useEffect, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import {
  FactbookCountrySearch,
  type FactbookCountryOption,
} from "./FactbookCountrySearch";

interface FactbookStickyCountrySearchProps {
  country: {
    name: string;
    iso2: string | null;
  };
  countries: ReadonlyArray<FactbookCountryOption>;
  sentinelId: string;
}

export function FactbookStickyCountrySearch({
  country,
  countries,
  sentinelId,
}: FactbookStickyCountrySearchProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById(sentinelId);
    if (!sentinel) {
      const id = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(id);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { rootMargin: "-56px 0px 0px 0px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelId]);

  useEffect(() => {
    document.documentElement.dataset.factbookStickySearch = visible
      ? "visible"
      : "hidden";

    return () => {
      delete document.documentElement.dataset.factbookStickySearch;
    };
  }, [visible]);

  return (
    <div
      className={`factbook-sticky-country-search${visible ? " is-visible" : ""}`}
    >
      <div className="factbook-sticky-country-search__inner">
        <div className="factbook-sticky-country-search__country">
          <CountryFlag iso2={country.iso2} size={24} />
          <span>{country.name}</span>
        </div>
        <FactbookCountrySearch
          countries={countries}
          compact
          showShortcut
          enableShortcut
          placeholder="Jump to country..."
          ariaLabel="Jump to a country factbook"
        />
      </div>
    </div>
  );
}
