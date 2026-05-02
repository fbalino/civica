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
import { useRouter } from "next/navigation";

export interface FactbookCountryOption {
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
}

interface FactbookCountrySearchProps {
  countries: ReadonlyArray<FactbookCountryOption>;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
}

function flagEmoji(iso2: string | null): string {
  if (!iso2) return "";
  return [...iso2.toUpperCase()]
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join("");
}

export function FactbookCountrySearch({
  countries,
  placeholder = "Jump to country...",
  compact = false,
  autoFocus = false,
}: FactbookCountrySearchProps) {
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
          country.iso2?.toLowerCase().includes(q) ||
          country.iso3?.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [countries, query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    setOpen(true);
  }, [autoFocus]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const navigate = useCallback(
    (slug: string) => {
      setOpen(false);
      setQuery("");
      router.push(`/factbook/${slug}`);
    },
    [router]
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
      navigate(filtered[selectedIdx].slug);
    } else if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      ref={rootRef}
      className={`factbook-search${compact ? " factbook-search--compact" : ""}`}
    >
      <div
        className="factbook-search-input-wrap"
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        <span className="factbook-search-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3.5 3.5" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open && filtered.length > 0}
          aria-controls={resultsId}
          aria-autocomplete="list"
          aria-label="Jump to a country factbook"
        />
      </div>

      {open && filtered.length > 0 && (
        <div
          id={resultsId}
          className="factbook-search-results"
          role="listbox"
          aria-label="Factbook country results"
        >
          {filtered.map((country, index) => (
            <button
              key={country.slug}
              type="button"
              role="option"
              aria-selected={index === selectedIdx}
              className={`factbook-search-result${
                index === selectedIdx ? " is-selected" : ""
              }`}
              onMouseEnter={() => setSelectedIdx(index)}
              onClick={() => navigate(country.slug)}
            >
              <span className="factbook-search-flag" aria-hidden="true">
                {flagEmoji(country.iso2)}
              </span>
              <span className="factbook-search-result-main">
                <span className="factbook-search-result-name">
                  {country.name}
                </span>
                {country.iso3 && (
                  <span className="factbook-search-result-code">
                    {country.iso3}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
