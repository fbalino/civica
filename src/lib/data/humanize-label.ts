// Humanise a raw factbook key into a presentable label.
//
// Source data uses inconsistent casing ("Capital", "name", "geographic
// coordinates", "country_name") because it follows the CIA Factbook keys
// verbatim.
//
// Two casings are exported:
//
// - humanizeLabel(key): sentence case — for `<dt>` field keys and
//   anywhere else microcopy reads better as a sentence-case fragment.
//   Example: "country name" → "Country name".
//
// - humanizeSectionLabel(key): title case — for section titles, sidebar
//   items, subsection headings, and any TOC entry. The site convention is
//   that headings get title case, with small words (and, of, the, &)
//   left lowercase unless they're at the start. Example:
//   "transnational issues" → "Transnational Issues",
//   "people and society" → "People and Society".
//
// Add to OVERRIDES_SENTENCE / OVERRIDES_TITLE when the default rule
// produces something awkward.

const ACRONYMS = new Set([
  "UN", "EU", "GDP", "GNI", "GNP", "ISO", "NGO", "IMF", "NATO",
  "ECOWAS", "AU", "EEA", "WHO", "WTO", "ASEAN", "OPEC", "BRICS",
  "UTC", "UK", "US", "USA", "UAE", "DC", "IT", "TV", "FM", "AM",
  "ID", "GPS", "PIN", "VAT", "CO2", "CC", "BY", "SA", "NC", "API",
  "HDI", "WGI", "CPI", "GPI", "QOG",
]);

const ACRONYM_DISPLAY: Record<string, string> = {
  QOG: "QoG",
};

// Words that stay lowercase in title case unless they're the first word.
// Standard Chicago / AP-style "small words". `&` is treated as a small
// word too so "Communications & Transport" reads naturally.
const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "en", "for", "if",
  "in", "of", "on", "or", "the", "to", "vs", "via", "with", "from",
  "&",
]);

const OVERRIDES_SENTENCE: Record<string, string> = {
  // Common factbook keys with awkward defaults
  "country name": "Country name",
  "government type": "Government type",
  "geographic coordinates": "Geographic coordinates",
  "time difference": "Time difference",
  "national holiday": "National holiday",
  "long form": "Long form",
  "short form": "Short form",
  "conventional long form": "Conventional long form",
  "conventional short form": "Conventional short form",
  "international organization participation": "International organisations",
  "head of state": "Head of state",
  "head of government": "Head of government",
  "executive branch": "Executive branch",
  "legislative branch": "Legislative branch",
  "judicial branch": "Judicial branch",
  "political parties": "Political parties",
  "political pressure groups": "Political pressure groups",
  "diplomatic representation in the us": "Diplomatic representation in the US",
  "diplomatic representation from the us": "Diplomatic representation from the US",
  "etymology": "Etymology",
  "name": "Name",
  "capital": "Capital",
  "flag description": "Flag description",
  "national symbol": "National symbol(s)",
  "national symbols": "National symbol(s)",
  "national anthem": "National anthem",
  "national colors": "National colours",
  "suffrage": "Suffrage",
  "constitution": "Constitution",
  "legal system": "Legal system",
  "citizenship": "Citizenship",
  "elections": "Elections",
};

const OVERRIDES_TITLE: Record<string, string> = {
  // Section / sidebar / subsection labels where the default would be
  // wrong (small-word handling, acronyms, ampersands, etc.).
  "people and society": "People and Society",
  "transnational issues": "Transnational Issues",
  "military and security": "Military and Security",
  "communications and transport": "Communications and Transport",
  "international organization participation": "International Organisations",
};

function applyAcronyms(input: string): string {
  return input.replace(/\b([a-z]+)\b/gi, (m) => {
    const upper = m.toUpperCase();
    return ACRONYMS.has(upper) ? ACRONYM_DISPLAY[upper] ?? upper : m;
  });
}

/**
 * Sentence-case label. Use for `<dt>` field keys and microcopy.
 * "country name" → "Country name".
 */
export function humanizeLabel(key: string): string {
  const normalised = key.trim().replace(/[_-]+/g, " ").toLowerCase();
  if (!normalised) return "";
  if (OVERRIDES_SENTENCE[normalised]) return OVERRIDES_SENTENCE[normalised];

  // Sentence case: first letter upper, rest lower.
  const result = normalised.charAt(0).toUpperCase() + normalised.slice(1);
  return applyAcronyms(result);
}

/**
 * Central display cleanup for raw database enum-ish values. This should be
 * used before rendering values that may arrive as snake_case, kebab-case, or
 * source abbreviations.
 */
export function prettyDisplayValue(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return humanizeLabel(trimmed);
}

/**
 * Title-case label. Use for section titles, sidebar items, subsection
 * headings, and TOC entries. Small words (and, of, the, &) stay lower
 * unless they're the first word; acronyms (UN, GDP) are preserved.
 *
 * "transnational issues" → "Transnational Issues"
 * "people and society"   → "People and Society"
 * "head of government"   → "Head of Government"
 */
export function humanizeSectionLabel(key: string): string {
  const normalised = key.trim().replace(/[_-]+/g, " ").toLowerCase();
  if (!normalised) return "";
  if (OVERRIDES_TITLE[normalised]) return OVERRIDES_TITLE[normalised];

  const words = normalised.split(/\s+/);
  const titled = words.map((word, i) => {
    // Match leading punctuation (e.g. "(area" → "(" + "area"). Only the
    // letter portion is acronym-checked / capitalised so "(area sq km)"
    // becomes "(Area Sq Km)" not "(area Sq Km)".
    const m = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}].*)?$/u);
    const lead = m?.[1] ?? "";
    const rest = m?.[2] ?? "";
    if (!rest) return word;
    const upper = rest.toUpperCase();
    if (ACRONYMS.has(upper)) return lead + (ACRONYM_DISPLAY[upper] ?? upper);
    if (i !== 0 && SMALL_WORDS.has(rest)) return word;
    return lead + rest.charAt(0).toUpperCase() + rest.slice(1);
  });

  return titled.join(" ");
}
