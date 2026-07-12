"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { CountryFlag } from "@/components/CountryFlag";
import type { JurisdictionStatusPresentation } from "@/lib/jurisdictions/status-presentation";

export interface CountrySearchOption {
  slug: string;
  name: string;
  iso2: string | null;
  iso3?: string | null;
  capital?: string | null;
  status?: JurisdictionStatusPresentation;
}

interface CountrySearchComboboxProps {
  countries: ReadonlyArray<CountrySearchOption>;
  placeholder?: string;
  ariaLabel?: string;
  countryPathPrefix?: string;
  /** Navigate to `countryPathPrefix?{countryQueryParam}=slug` instead of a path segment. */
  countryQueryParam?: string;
  hrefForCountry?: (country: CountrySearchOption) => string;
  onSelect?: (country: CountrySearchOption) => void;
  autoFocus?: boolean;
  compact?: boolean;
  showShortcut?: boolean;
  enableShortcut?: boolean;
  /** Optional trailing sliders/filter affordance (component spec §4). */
  showFilterIcon?: boolean;
  className?: string;
}

export function CountrySearchCombobox({
  countries,
  placeholder = "Search countries...",
  ariaLabel = "Search countries",
  countryPathPrefix = "/country",
  countryQueryParam,
  hrefForCountry,
  onSelect,
  autoFocus = false,
  compact = false,
  showShortcut = false,
  enableShortcut = false,
  showFilterIcon = false,
  className,
}: CountrySearchComboboxProps) {
  const router = useRouter();
  const resultsId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return countries
      .filter((country) => {
        return (
          country.name.toLowerCase().includes(q) ||
          country.capital?.toLowerCase().includes(q) ||
          country.iso2?.toLowerCase().includes(q) ||
          country.iso3?.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [countries, query]);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!enableShortcut) return;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (
        event.key.toLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey)
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enableShortcut]);

  const selectCountry = useCallback(
    (country: CountrySearchOption) => {
      setOpen(false);
      setQuery("");
      if (onSelect) {
        onSelect(country);
        return;
      }
      router.push(
        hrefForCountry
          ? hrefForCountry(country)
          : countryQueryParam
            ? `${countryPathPrefix}?${new URLSearchParams({ [countryQueryParam]: country.slug })}`
            : `${countryPathPrefix.replace(/\/$/, "")}/${country.slug}`,
      );
    },
    [countryPathPrefix, countryQueryParam, hrefForCountry, onSelect, router],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIdx((idx) => Math.min(idx + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIdx((idx) => Math.max(idx - 1, 0));
    } else if (event.key === "Enter" && filtered[selectedIdx]) {
      event.preventDefault();
      selectCountry(filtered[selectedIdx]);
    } else if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      ref={rootRef}
      className={[
        "country-search",
        compact ? "country-search--compact" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="country-search__field"
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        <Search className="country-search__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIdx(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open && filtered.length > 0}
          aria-controls={resultsId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          autoComplete="off"
        />
        {showShortcut ? (
          <kbd className="country-search__shortcut">⌘K</kbd>
        ) : null}
        {showFilterIcon ? (
          <SlidersHorizontal
            className="country-search__filter-icon"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {open && filtered.length > 0 ? (
        <div
          id={resultsId}
          className="country-search__results"
          role="listbox"
          aria-label="Country results"
        >
          {filtered.map((country, index) => (
            <button
              key={country.slug}
              type="button"
              role="option"
              aria-selected={index === selectedIdx}
              className={`country-search__result${
                index === selectedIdx ? " is-selected" : ""
              }`}
              onMouseEnter={() => setSelectedIdx(index)}
              onClick={() => selectCountry(country)}
            >
              <span className="country-search__flag" aria-hidden="true">
                <CountryFlag iso2={country.iso2} size={20} />
              </span>
              <span className="country-search__result-main">
                <span className="country-search__result-name">
                  {country.name}
                </span>
                <span className="country-search__result-meta">
                  {[country.status?.label, country.capital, country.iso3]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
