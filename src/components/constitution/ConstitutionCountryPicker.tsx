"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { CountryFlag } from "@/components/CountryFlag";
import type { IndexedConstitutionCountry } from "@/lib/db/queries-constitution";

interface ConstitutionCountryPickerProps {
  countries: IndexedConstitutionCountry[];
  /** Selected slugs in order (primary first). */
  selectedSlugs: string[];
  /** Max total selections. */
  maxSlugs?: number;
}

function buildHref(slugs: string[]): string {
  if (slugs.length === 0) return "/constitution";
  return `/constitution?${slugs.map((s) => `c=${encodeURIComponent(s)}`).join("&")}`;
}

/**
 * LEFT pane. A searchable list of the 186 indexed constitutions. Clicking a
 * country READS it (makes it the primary `?c=` slug, keeping any peers).
 * Selected countries show above the list with remove controls; a country can
 * be promoted to primary or added as a comparison peer.
 */
export function ConstitutionCountryPicker({
  countries,
  selectedSlugs,
  maxSlugs = 4,
}: ConstitutionCountryPickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const bySlug = useMemo(
    () => new Map(countries.map((c) => [c.slug, c])),
    [countries],
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = q
      ? countries.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.iso2?.toLowerCase() === q ||
            c.iso3?.toLowerCase() === q,
        )
      : countries;
    return base.slice(0, q ? 40 : 250);
  }, [countries, q]);

  const canAddMore = selectedSlugs.length < maxSlugs;

  /** Make a country the primary reading target (front of the list). */
  const readCountry = (slug: string) => {
    const rest = selectedSlugs.filter((s) => s !== slug);
    router.push(buildHref([slug, ...rest].slice(0, maxSlugs)));
  };

  /** Add a country as a comparison peer (appended). */
  const addPeer = (slug: string) => {
    if (selectedSlugs.includes(slug)) return;
    router.push(buildHref([...selectedSlugs, slug].slice(0, maxSlugs)));
  };

  const removeCountry = (slug: string) => {
    router.push(buildHref(selectedSlugs.filter((s) => s !== slug)));
  };

  return (
    <div className="constitution-picker">
      <div className="constitution-picker-head">
        <h2 className="constitution-picker-title">Constitutions</h2>
        <p className="constitution-picker-count">
          {countries.length} indexed
        </p>
      </div>

      {selectedSlugs.length > 0 ? (
        <div className="constitution-picker-selected">
          {selectedSlugs.map((slug, i) => {
            const c = bySlug.get(slug);
            return (
              <div
                key={slug}
                className={`constitution-picker-chip${
                  i === 0 ? " constitution-picker-chip--primary" : ""
                }`}
              >
                <span className="constitution-picker-chip-flag" aria-hidden>
                  <CountryFlag iso2={c?.iso2 ?? null} size={16} />
                </span>
                <span className="constitution-picker-chip-name">
                  {c?.name ?? slug}
                </span>
                {i === 0 ? (
                  <span className="constitution-picker-chip-role">Reading</span>
                ) : null}
                <button
                  type="button"
                  className="constitution-picker-chip-remove"
                  aria-label={`Remove ${c?.name ?? slug}`}
                  onClick={() => removeCountry(slug)}
                >
                  <X size={12} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="constitution-picker-search">
        <Search aria-hidden className="constitution-picker-search-icon" />
        <input
          type="search"
          value={query}
          placeholder="Search countries…"
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search indexed constitutions"
          autoComplete="off"
        />
      </div>

      <ul className="constitution-picker-list" role="list">
        {filtered.map((c) => {
          const isSelected = selectedSlugs.includes(c.slug);
          const isPrimary = selectedSlugs[0] === c.slug;
          return (
            <li key={c.slug} className="constitution-picker-item">
              <button
                type="button"
                className={`constitution-picker-item-main${
                  isPrimary ? " is-primary" : ""
                }`}
                onClick={() => readCountry(c.slug)}
                aria-current={isPrimary ? "true" : undefined}
              >
                <span className="constitution-picker-item-flag" aria-hidden>
                  <CountryFlag iso2={c.iso2} size={18} />
                </span>
                <span className="constitution-picker-item-name">{c.name}</span>
                {c.year ? (
                  <span className="constitution-picker-item-year">
                    {c.yearUpdated && c.yearUpdated !== c.year
                      ? c.yearUpdated
                      : c.year}
                  </span>
                ) : null}
              </button>
              {!isSelected && canAddMore && selectedSlugs.length > 0 ? (
                <button
                  type="button"
                  className="constitution-picker-item-add"
                  onClick={() => addPeer(c.slug)}
                  aria-label={`Add ${c.name} as a comparison`}
                  title="Add as comparison"
                >
                  +
                </button>
              ) : null}
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="constitution-picker-empty">
            No indexed constitution matches “{query}”.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
