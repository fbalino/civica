// Civica Atlas uses two identifier spaces:
//   - 3-letter atlas id ("fra", "usa") — static data layer, SVG path data-id,
//     compare pin state, and the /api/countries/<id>/international endpoint
//   - DB slug ("france", "united-states") — every other API route and the
//     canonical public URL (/atlas/<slug>, /countries/<slug>)
//
// These helpers consolidate the ad-hoc `country.slug ?? country.id` and
// `COUNTRIES.find((c) => (c.slug ?? c.id) === x || c.id === x)` patterns that
// were scattered across AtlasApp.tsx.

export type AtlasTab =
  | "chamber"
  | "bills"
  | "structure"
  | "elections"
  | "democracy"
  | "leaders"
  | "constitution"
  | "international";

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

export function slugToAtlasId<T extends HasIdAndSlug>(
  slug: string,
  countries: readonly T[],
): string | null {
  const match = countries.find(
    (c) => c.slug === slug || c.id === slug,
  );
  return match?.id ?? null;
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
  "chamber",
  "bills",
  "structure",
  "elections",
  "democracy",
  "leaders",
  "constitution",
  "international",
]);

export function isAtlasTab(value: string): value is AtlasTab {
  return VALID_TABS.has(value as AtlasTab);
}

export function isAtlasHouse(value: string): value is AtlasHouse {
  return value === "upper" || value === "lower";
}

export function buildAtlasUrl(
  slug: string,
  tab: AtlasTab = "chamber",
  house?: AtlasHouse,
): string {
  const base = `/atlas/${slug}/${tab}`;
  return house ? `${base}?house=${house}` : base;
}

// The chat context scoping rule: house is only semantically relevant on the
// chamber and bills tabs. Strip it from apiContext/contextChips elsewhere so
// /api/chat isn't getting noisy state (e.g. house=lower on the Democracy tab).
export function tabNeedsHouse(tab: AtlasTab): boolean {
  return tab === "chamber" || tab === "bills";
}

export const ATLAS_TAB_LABELS: Record<AtlasTab, string> = {
  chamber: "Chamber",
  bills: "Bills",
  structure: "Structure",
  elections: "Elections",
  democracy: "Democracy",
  leaders: "Leaders",
  constitution: "Constitution",
  international: "International",
};
