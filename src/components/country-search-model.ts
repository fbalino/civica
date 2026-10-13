/**
 * Pure matching and keyboard-selection rules for `CountrySearchCombobox`,
 * kept outside the client component so they can be tested directly.
 */
export interface CountrySearchMatchable {
  name: string;
  iso2: string | null;
  iso3?: string | null;
  capital?: string | null;
}

export const COUNTRY_SEARCH_RESULT_LIMIT = 8;

/** Case-insensitive match on name, capital, ISO-2, or ISO-3; at most 8. */
export function filterCountryOptions<T extends CountrySearchMatchable>(
  countries: ReadonlyArray<T>,
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return countries
    .filter(
      (country) =>
        country.name.toLowerCase().includes(q) ||
        country.capital?.toLowerCase().includes(q) ||
        country.iso2?.toLowerCase().includes(q) ||
        country.iso3?.toLowerCase().includes(q),
    )
    .slice(0, COUNTRY_SEARCH_RESULT_LIMIT);
}

/** Pull an index into the valid range of `length` results (0 when empty). */
export function clampSelectedIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

/**
 * Arrow-key movement over `length` results. Never leaves the valid range, so
 * a key pressed while the shared directory is still loading (an empty list)
 * cannot strand the selection at -1 once results arrive.
 */
export function nextSelectedIndex(
  current: number,
  direction: 1 | -1,
  length: number,
): number {
  if (length <= 0) return 0;
  return clampSelectedIndex(Math.min(current, length - 1) + direction, length);
}
