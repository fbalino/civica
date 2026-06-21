// Civica Atlas uses two identifier spaces:
//   - 3-letter atlas id ("fra", "usa") — static data layer, SVG path data-id,
//     compare pin state, and the /api/countries/<id>/international endpoint
//   - DB slug ("france", "united-states") — every other API route and the
//     canonical public URL (/atlas/<slug>, /countries/<slug>)
//
// These helpers consolidate the ad-hoc `country.slug ?? country.id` and
// `COUNTRIES.find((c) => (c.slug ?? c.id) === x || c.id === x)` patterns that
// were scattered across AtlasApp.tsx.

// Phase C — tab consolidation 8 → 6.
//   Chamber folded into Structure (the upper/lower toggle now lives inside
//   the Structure tab), and Democracy folded into a new Scores & Rankings
//   tab. Roman-numeral prefixes dropped. `next.config.ts` carries 301
//   redirects from the retired URLs.
export type AtlasTab =
  | "structure"
  | "bills"
  | "leaders"
  | "constitution"
  | "international"
  | "scores";

export type AtlasHouse = "upper" | "lower";

// Minimal structural type: works with both `Country` (data.ts) and
// `AtlasCountry` (load-atlas-data.ts) without importing either.
interface HasIdAndSlug {
  id: string;
  slug?: string;
}

export function atlasIdToSlug<T extends HasIdAndSlug>(
  id: string,
  countries: readonly T[],
): string {
  const match = countries.find((c) => c.id === id);
  return match?.slug ?? id.toLowerCase();
}

export function slugToCountry<T extends HasIdAndSlug>(
  slugOrId: string,
  countries: readonly T[],
): T | null {
  return (
    countries.find(
      (c) => c.slug === slugOrId || c.id === slugOrId,
    ) ?? null
  );
}

const VALID_TABS: ReadonlySet<AtlasTab> = new Set([
  "structure",
  "bills",
  "leaders",
  "constitution",
  "international",
  "scores",
]);

export function isAtlasTab(value: string): value is AtlasTab {
  return VALID_TABS.has(value as AtlasTab);
}

export function isAtlasHouse(value: string): value is AtlasHouse {
  return value === "upper" || value === "lower";
}

export const DEFAULT_ATLAS_TAB: AtlasTab = "structure";

export function buildAtlasUrl(
  slug: string,
  tab: AtlasTab = DEFAULT_ATLAS_TAB,
  house?: AtlasHouse,
): string {
  const base = `/atlas/${slug}/${tab}`;
  return house ? `${base}?house=${house}` : base;
}

// The chat context scoping rule: house is only semantically relevant on the
// Structure tab now (because Chamber folded into Structure and the upper/
// lower toggle lives there). Other tabs render country-level data and
// piping `house` into their chat context just adds noise.
export function tabNeedsHouse(tab: AtlasTab): boolean {
  return tab === "structure";
}

export const ATLAS_TAB_LABELS: Record<AtlasTab, string> = {
  structure: "Structure",
  bills: "Bills",
  leaders: "Leaders",
  constitution: "Constitution",
  international: "International",
  scores: "Scores & Rankings",
};

// Display order for the tab bar.
export const ATLAS_TAB_ORDER: AtlasTab[] = [
  "structure",
  "bills",
  "leaders",
  "constitution",
  "international",
  "scores",
];
