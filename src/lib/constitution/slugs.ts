/**
 * Shared `?c=` slug parsing for multi-country reader surfaces.
 *
 * Mirrors the private `parseSlugs` in `src/app/compare/page.tsx` (lines 36–41)
 * so both the Compare page and the Constitution Explorer read the `c` search
 * param identically — deduped, capped, order-preserving. Extracted here rather
 * than copy-pasted so the two surfaces can never drift on how they interpret
 * the URL. (Compare keeps its own copy for now; this util is the canonical one
 * new surfaces should import.)
 */

/** Default cap on how many countries a comparison surface accepts. */
export const DEFAULT_MAX_SLUGS = 4;

/**
 * Normalize a raw `searchParams.c` value (string | string[] | undefined) into
 * an ordered, deduped list of non-empty slug strings, capped at `max`.
 *
 * The first slug is the "primary" country (the one being read); any remaining
 * slugs are cross-reference peers.
 */
export function parseCountrySlugs(
  raw: string | string[] | undefined,
  max: number = DEFAULT_MAX_SLUGS,
): string[] {
  const arr: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (typeof s !== "string") continue;
    const slug = s.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= max) break;
  }
  return out;
}
