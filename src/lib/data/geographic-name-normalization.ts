// Geographic-name normalization for display.
//
// Civica imports the CIA World Factbook *verbatim* and stores it as raw
// JSONB in `country_factbook_sections.section_data`. We deliberately do
// NOT mutate that stored source — the cleanest provenance posture is
// "we store the source as-is; we display our house naming convention,
// with a transparent note." This module is the display-layer seam where
// that house convention is applied.
//
// ── Why "Gulf of Mexico" ──────────────────────────────────────────────
// For an international, academically-citable reference work, the
// defensible primary name for the body of water is "Gulf of Mexico" —
// the name used by the International Hydrographic Organization, the
// United Nations, Wikipedia, Britannica, AP, Reuters, and the BBC. A
// U.S. executive order issued in January 2025 renamed it "Gulf of
// America" for U.S. federal agencies; that order binds only the U.S.
// federal government and carries no international standing (the United
// States borders under half of the gulf's coastline). The CIA World
// Factbook — itself a U.S. federal publication — adopted the executive
// order's wording, which is why our public-domain import surfaces
// "Gulf of America" in the Geography sections of the United States,
// Mexico, and Canada.
//
// This is a deliberate editorial naming convention, not a data fix. We
// keep the source row untouched and normalize only at render time, then
// disclose the divergence to the reader with a neutral provenance note.
//
// ── Scope discipline ──────────────────────────────────────────────────
// This is a TARGETED phrase map, intentionally limited to this single
// rename. Do NOT generalize it (e.g. Denali/Mt. McKinley, or any future
// U.S.-federal geographic rename). Per the project's research-lab
// posture, each such rename must be evaluated case-by-case against the
// same international-reference standard (IHO / UN / major encyclopedias
// and wire services) before being added here — it must not be applied
// automatically just because a U.S. executive order changed it.

/**
 * Exact phrase substitutions applied to display text. Keys are matched
 * as plain substrings (the phrase is distinctive enough that a substring
 * match is word-boundary safe in practice, and it naturally handles the
 * parenthetical form "(Gulf of America)" and the article form "the Gulf
 * of America" because the exact phrase appears intact inside both).
 */
const DISPLAY_PHRASE_MAP: ReadonlyArray<readonly [from: string, to: string]> = [
  ["Gulf of America", "Gulf of Mexico"],
];

/**
 * Replace every occurrence of each mapped phrase in a single display
 * string. Cheap and allocation-free when the text contains no mapped
 * phrase (the common case), since `String.prototype.replaceAll` returns
 * the same string when there is nothing to replace.
 */
export function normalizeGeographicNames(text: string): string {
  let out = text;
  for (const [from, to] of DISPLAY_PHRASE_MAP) {
    if (out.includes(from)) {
      out = out.replaceAll(from, to);
    }
  }
  return out;
}

/**
 * True when applying {@link normalizeGeographicNames} to `text` would
 * change it (i.e. the text contains at least one mapped phrase). Used by
 * the render layer to decide whether to show the provenance note for a
 * given section — the note must appear ONLY where a normalization
 * actually occurred, never on a country/section with no Gulf reference.
 */
export function geographicNameWasNormalized(text: string): boolean {
  return DISPLAY_PHRASE_MAP.some(([from]) => text.includes(from));
}

/**
 * Deep scan of an arbitrary JSONB value (a factbook section's
 * `section_data`) for any mapped phrase. The factbook field tree nests a
 * few levels deep — the gulf reference lives in a depth-3 leaf for the
 * "Major watersheds → Atlantic Ocean drainage" entry — so this walks
 * strings, arrays, and the `{ text: "..." }` leaf shape the importer
 * uses. Returns true as soon as a mapped phrase is found.
 *
 * This is intentionally independent of the render walker so a page can
 * decide whether to show the provenance note for a section without
 * having to thread a flag back up out of the leaf renderer.
 */
export function sectionDataHasNormalizableGeographicName(
  data: unknown,
): boolean {
  if (data == null) return false;
  if (typeof data === "string") return geographicNameWasNormalized(data);
  if (Array.isArray(data)) {
    return data.some((v) => sectionDataHasNormalizableGeographicName(v));
  }
  if (typeof data === "object") {
    return Object.values(data as Record<string, unknown>).some((v) =>
      sectionDataHasNormalizableGeographicName(v),
    );
  }
  return false;
}
