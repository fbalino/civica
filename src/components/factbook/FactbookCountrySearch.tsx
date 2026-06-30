"use client";

import {
  CountrySearchCombobox,
  type CountrySearchOption,
} from "@/components/CountrySearchCombobox";

export type FactbookCountryOption = CountrySearchOption;

interface FactbookCountrySearchProps {
  countries: ReadonlyArray<FactbookCountryOption>;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  countryPathPrefix?: string;
  ariaLabel?: string;
  showShortcut?: boolean;
  enableShortcut?: boolean;
  className?: string;
}

export function FactbookCountrySearch({
  countries,
  placeholder = "Jump to country...",
  compact = false,
  autoFocus = false,
  countryPathPrefix = "/country",
  ariaLabel = "Jump to a country",
  showShortcut = false,
  enableShortcut = false,
  className,
}: FactbookCountrySearchProps) {
  return (
    <CountrySearchCombobox
      countries={countries}
      placeholder={placeholder}
      compact={compact}
      autoFocus={autoFocus}
      countryPathPrefix={countryPathPrefix}
      ariaLabel={ariaLabel}
      showShortcut={showShortcut}
      enableShortcut={enableShortcut}
      className={className}
    />
  );
}
