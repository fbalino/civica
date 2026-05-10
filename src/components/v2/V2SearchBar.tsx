"use client";

export function V2SearchBar({
  placeholder = "Search countries, regions, institutions…",
  shortcut = "⌘K",
}: {
  placeholder?: string;
  shortcut?: string;
}) {
  return (
    <label className="v2-search">
      <svg
        className="v2-search__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
      <input
        className="v2-search__input"
        type="search"
        placeholder={placeholder}
        aria-label="Search Civica"
      />
      <span className="v2-search__shortcut">{shortcut}</span>
    </label>
  );
}
