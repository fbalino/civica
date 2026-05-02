"use client";

import { useEffect, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import {
  FactbookCountrySearch,
  type FactbookCountryOption,
} from "./FactbookCountrySearch";

interface FactbookMobileSubheaderProps {
  country: {
    name: string;
    iso2: string | null;
  };
  countries: ReadonlyArray<FactbookCountryOption>;
  sentinelId: string;
}

export function FactbookMobileSubheader({
  country,
  countries,
  sentinelId,
}: FactbookMobileSubheaderProps) {
  const [visible, setVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById(sentinelId);
    if (!sentinel) {
      setVisible(true);
      return;
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

  return (
    <div
      className={`factbook-mobile-subheader${
        visible ? " is-visible" : ""
      }${searchOpen ? " is-searching" : ""}`}
      aria-hidden={!visible}
    >
      {searchOpen ? (
        <>
          <FactbookCountrySearch
            countries={countries}
            compact
            autoFocus
            placeholder="Jump to country..."
          />
          <button
            type="button"
            className="factbook-mobile-subheader-action"
            onClick={() => setSearchOpen(false)}
          >
            Close
          </button>
        </>
      ) : (
        <>
          <div className="factbook-mobile-subheader-country">
            <CountryFlag iso2={country.iso2} size={24} />
            <span>{country.name}</span>
          </div>
          <button
            type="button"
            className="factbook-mobile-subheader-action"
            onClick={() => setSearchOpen(true)}
          >
            Search
          </button>
        </>
      )}
    </div>
  );
}
