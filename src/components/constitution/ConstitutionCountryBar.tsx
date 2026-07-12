"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { CountryFlag } from "@/components/CountryFlag";
import type { IndexedConstitutionCountry } from "@/lib/db/queries-constitution";

interface ConstitutionCountryBarProps {
  /** The full alphabetical list of indexed constitutions (for the popover). */
  countries: IndexedConstitutionCountry[];
  /** Selected slugs in order (primary/reading first). */
  selectedSlugs: string[];
  /** Max total selections. */
  maxSlugs?: number;
}

function buildHref(slugs: string[]): string {
  if (slugs.length === 0) return "/constitution";
  return `/constitution?${slugs.map((s) => `c=${encodeURIComponent(s)}`).join("&")}`;
}

/**
 * Header country management for the explorer. Renders one tonal chip per
 * selected country (flag + name + ×; the first chip is the one being READ,
 * marked with a subtle "Reading" affix). "+ Add country" opens a searchable
 * anchored popover — the same interaction pattern as the almanac filter
 * dropdowns (`.almanac-dd__*`), mirrored here with `.constitution-add__*` so
 * the constitution styles stay self-contained in editorial.css.
 *
 * Removing a chip drops it from the `?c=` set; removing the reading country
 * promotes the next in line. Clicking a popover row adds a peer (cap `maxSlugs`)
 * and closes.
 */
export function ConstitutionCountryBar({
  countries,
  selectedSlugs,
  maxSlugs = 4,
}: ConstitutionCountryBarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const bySlug = useMemo(
    () => new Map(countries.map((c) => [c.slug, c])),
    [countries],
  );

  const canAddMore = selectedSlugs.length < maxSlugs;
  const closePopover = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveSlug(null);
  }, []);

  // Close on outside click / Escape (Escape returns focus to the trigger).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closePopover();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePopover();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePopover, open]);

  // Focus the search input when the popover opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
    return base.slice(0, q ? 60 : 250);
  }, [countries, q]);

  const available = filtered.filter((c) => !selectedSlugs.includes(c.slug));

  const moveActive = (direction: 1 | -1) => {
    if (available.length === 0) return;
    const current = available.findIndex((c) => c.slug === activeSlug);
    const next =
      current < 0
        ? direction > 0
          ? 0
          : available.length - 1
        : (current + direction + available.length) % available.length;
    setActiveSlug(available[next].slug);
  };

  const removeCountry = (slug: string) => {
    router.push(buildHref(selectedSlugs.filter((s) => s !== slug)));
  };

  const addPeer = (slug: string) => {
    if (selectedSlugs.includes(slug)) return;
    router.push(buildHref([...selectedSlugs, slug].slice(0, maxSlugs)));
    closePopover();
  };

  return (
    <div className="constitution-country-bar">
      {selectedSlugs.map((slug, i) => {
        const c = bySlug.get(slug);
        const isReading = i === 0;
        return (
          <span
            key={slug}
            className={`constitution-country-chip${
              isReading ? " constitution-country-chip--reading" : ""
            }`}
          >
            <span className="constitution-country-chip__flag" aria-hidden>
              <CountryFlag iso2={c?.iso2 ?? null} size={16} />
            </span>
            <span className="constitution-country-chip__name">
              {c?.name ?? slug}
            </span>
            {isReading ? (
              <span className="constitution-country-chip__role">Reading</span>
            ) : null}
            <button
              type="button"
              className="constitution-country-chip__x"
              aria-label={`Remove ${c?.name ?? slug}`}
              onClick={() => removeCountry(slug)}
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        );
      })}

      {canAddMore ? (
        <div className="constitution-add" ref={rootRef}>
          <button
            ref={triggerRef}
            type="button"
            className="constitution-add__trigger"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? `${listboxId}-dialog` : undefined}
            onClick={() => {
              if (open) closePopover();
              else setOpen(true);
            }}
          >
            + Add country
          </button>
          {open ? (
            <div
              className="constitution-add__menu"
              id={`${listboxId}-dialog`}
              role="dialog"
              aria-label="Add a constitution to compare"
            >
              <div className="constitution-add__search">
                <Search aria-hidden className="constitution-add__search-icon" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  placeholder="Search countries…"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveSlug(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      moveActive(e.key === "ArrowDown" ? 1 : -1);
                    } else if (e.key === "Home" && available.length > 0) {
                      e.preventDefault();
                      setActiveSlug(available[0].slug);
                    } else if (e.key === "End" && available.length > 0) {
                      e.preventDefault();
                      setActiveSlug(available[available.length - 1].slug);
                    } else if (e.key === "Enter" && activeSlug) {
                      e.preventDefault();
                      addPeer(activeSlug);
                    }
                  }}
                  aria-label="Search indexed constitutions"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-expanded="true"
                  aria-activedescendant={
                    activeSlug ? `${listboxId}-${activeSlug}` : undefined
                  }
                  autoComplete="off"
                />
              </div>
              <ul
                className="constitution-add__list"
                id={listboxId}
                role="listbox"
                aria-label="Indexed constitutions"
              >
                {filtered.map((c) => {
                  const isSelected = selectedSlugs.includes(c.slug);
                  const yr =
                    c.yearUpdated && c.yearUpdated !== c.year
                      ? c.yearUpdated
                      : c.year;
                  return (
                    <li key={c.slug}>
                      <button
                        type="button"
                        id={`${listboxId}-${c.slug}`}
                        role="option"
                        aria-selected={isSelected}
                        className={`constitution-add__option${
                          isSelected ? " is-selected" : ""
                        }${activeSlug === c.slug ? " is-active" : ""
                        }`}
                        disabled={isSelected}
                        tabIndex={-1}
                        onMouseMove={() => {
                          if (!isSelected) setActiveSlug(c.slug);
                        }}
                        onClick={() => addPeer(c.slug)}
                      >
                        <span
                          className="constitution-add__option-flag"
                          aria-hidden
                        >
                          <CountryFlag iso2={c.iso2} size={18} />
                        </span>
                        <span className="constitution-add__option-name">
                          {c.name}
                        </span>
                        {isSelected ? (
                          <span className="constitution-add__option-added">
                            Added
                          </span>
                        ) : yr ? (
                          <span className="constitution-add__option-year">
                            {yr}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 ? (
                  <li className="constitution-add__empty">
                    No indexed constitution matches “{query}”.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
