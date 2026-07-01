/**
 * titleCaseTitle — DISPLAY-ONLY title-casing for office / leader-role titles.
 *
 * Some stored office titles are raw lowercase Wikidata labels ("monarch of
 * Spain", "president of Germany", "monarch of the United Kingdom"). This util
 * title-cases them for display WITHOUT mutating the stored data and WITHOUT
 * altering the meaning of already-correct titles.
 *
 * Rules:
 *   - Capitalise the first letter of each significant word.
 *   - Keep small words (of / the / and / for / to / in / on / a / an / …)
 *     lowercase UNLESS they are the first word.
 *   - Preserve every character that is already there otherwise — this is
 *     additive-only casing. Interior capitals ("French", "McKinley",
 *     "São Tomé"), hyphenated parts ("co-prince" → "Co-Prince"), and
 *     non-Latin scripts are never down-cased, so a title that is already
 *     correct ("President of Argentina", "French co-prince of Andorra")
 *     keeps its meaning.
 *
 * Contrast with `humanizeSectionLabel` (src/lib/data/humanize-label.ts),
 * which is a factbook-KEY humaniser: it lowercases the whole string and
 * flattens `-`/`_` to spaces. That is correct for snake_case keys but would
 * destroy an already-correct real title (dropping the hyphen in "co-prince",
 * mangling "O le Ao o le Malo"), so it must NOT be used for stored titles.
 */

// Small words that stay lowercase in title case unless first. Chicago/AP-ish.
const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "if",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "via",
  "with",
  "from",
]);

/** Upper-case the first Latin letter of a token, leaving the rest untouched. */
function capitaliseFirstLetter(token: string): string {
  // Match a leading run of non-letter chars (quotes, parens, etc.), then the
  // first letter, then the tail. Only the first letter is up-cased; the tail
  // is preserved verbatim so interior capitals and diacritics survive.
  return token.replace(
    /^([^\p{L}]*)(\p{L})(.*)$/u,
    (_m, lead: string, first: string, tail: string) =>
      lead + first.toLocaleUpperCase() + tail,
  );
}

/**
 * Title-case a single word, respecting the hyphen so each hyphen-segment gets
 * its own capital ("co-prince" → "Co-Prince"). Small-word logic is applied by
 * the caller (it needs the word's position), so this always capitalises.
 */
function titleCaseWord(word: string): string {
  return word
    .split("-")
    .map((part) => capitaliseFirstLetter(part))
    .join("-");
}

/**
 * Title-case an office/leader-role title for display. Idempotent, pure, and
 * safe on already-correct titles. Returns the input unchanged when it is
 * empty/whitespace.
 */
export function titleCaseTitle(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/);
  return words
    .map((word, i) => {
      // A small word keeps its own casing (usually lowercase) unless it leads.
      if (i !== 0 && SMALL_WORDS.has(word.toLowerCase())) {
        return word;
      }
      return titleCaseWord(word);
    })
    .join(" ");
}
