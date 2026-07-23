import PARTY_COLOR_REGISTRY from "./party-color-registry.json";

// Party brand hues are sourced display metadata, not Civica UI tokens. Keeping
// the registered palette in JSON makes that data boundary explicit while all
// component and page styling remains token-based.
const WELL_KNOWN_PARTIES: Record<string, string> =
  PARTY_COLOR_REGISTRY.wellKnownParties;
const NAMED_COLORS: Record<string, string> = PARTY_COLOR_REGISTRY.namedColors;
const FALLBACK_PALETTE: readonly string[] = PARTY_COLOR_REGISTRY.fallbackPalette;

export function resolvePartyColor(
  dbColor: string | null | undefined,
  partyName: string | null | undefined,
  index: number,
): string {
  if (dbColor) {
    if (dbColor.startsWith("#") || dbColor.startsWith("oklch") || dbColor.startsWith("rgb")) return dbColor;
    const named = NAMED_COLORS[dbColor.toLowerCase()];
    if (named) return named;
  }

  if (partyName) {
    const key = partyName.toLowerCase().trim();
    const known = WELL_KNOWN_PARTIES[key];
    if (known) return known;
    for (const [pattern, color] of Object.entries(WELL_KNOWN_PARTIES)) {
      if (key.includes(pattern) || pattern.includes(key)) return color;
    }
  }

  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}
