/**
 * Civica map cartography — base source + runtime recolor to the design tokens.
 *
 * The default country-page map is MapLibre GL restyled at runtime to the Civica
 * palette so it reads like the almanac instead of a stock basemap. There are two
 * tile back-ends, selected by env:
 *
 *   1. SELF-HOSTED (preferred) — a single Protomaps `.pmtiles` planet extract on
 *      Vercel Blob, read directly by the browser over HTTP range requests via the
 *      `pmtiles` protocol (no tile server, no meter). Enabled when
 *      `NEXT_PUBLIC_BASEMAP_PMTILES_URL` is set. The MapLibre style is generated
 *      from `@protomaps/basemaps` `layers()` with a Civica-tinted flavor derived
 *      from the SAME live design tokens the OpenFreeMap recolor reads, so the two
 *      back-ends look the same and both track light/dark.
 *
 *   2. FALLBACK — free, keyless OpenFreeMap (OpenMapTiles/positron), recolored in
 *      place by `recolorCivicaMap`. Used automatically when the env var is unset.
 *
 * Palette is READ FROM THE LIVE CSS CUSTOM PROPERTIES (`--color-bg`,
 * `--color-text-primary`, `--color-divider`, `--color-accent`, …) at build/recolor
 * time, so the map automatically matches the site's current light/dark theme and
 * any future palette change — no hardcoded brand hexes here. The only literal
 * colors are the three cartographic tints (water / park / building) that have no
 * exact design token; those are the sanctioned map-data exception (like
 * `DesignSystemSwatch`), kept here in one place and theme-aware.
 *
 * See plan/self-hosted-tiles-v1.md for the tile build, hosting, and cost design.
 */
import type {
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";
import type { Flavor } from "@protomaps/basemaps";

/** Free, keyless OpenMapTiles vector base. Fallback tile source. */
export const CIVICA_MAP_BASE_STYLE =
  "https://tiles.openfreemap.org/styles/positron";

/**
 * Self-hosted Protomaps `.pmtiles` archive URL (Vercel Blob today; a future move
 * to Cloudflare R2 is a URL swap). When set, the map uses the owned basemap; when
 * unset, it falls back to OpenFreeMap. `NEXT_PUBLIC_` so it's readable client-side.
 */
export const BASEMAP_PMTILES_URL =
  process.env.NEXT_PUBLIC_BASEMAP_PMTILES_URL?.trim() || "";

/** True when the self-hosted basemap is configured (else OpenFreeMap fallback). */
export function isPmtilesEnabled(): boolean {
  return BASEMAP_PMTILES_URL.length > 0;
}

/**
 * The MapLibre source id for the self-hosted vector tiles. Must match what
 * `buildCivicaPmtilesStyle()` passes to `layers()` as the source name.
 */
export const CIVICA_PMTILES_SOURCE = "civica";

/**
 * The base extract only goes to z9 (whole-country framing needs no more). Cap the
 * map's max zoom in the self-hosted path so a user can't zoom past available detail
 * into blur; ~2 levels of vector overzoom keeps microstate framing crisp.
 */
export const CIVICA_PMTILES_MAX_ZOOM = 11;

/**
 * Glyphs (font PBFs) for the self-hosted style live next to the archive on Blob,
 * under `<blob-base>/basemap/fonts/{fontstack}/{range}.pbf`. Derive the base from
 * the archive URL so a host move only touches one env var.
 */
function glyphsUrlFor(pmtilesUrl: string): string {
  // Strip the archive filename to get the containing folder, then point at fonts.
  const base = pmtilesUrl.replace(/\/[^/]*$/, "");
  return `${base}/fonts/{fontstack}/{range}.pbf`;
}

export interface CivicaMapPalette {
  paper: string; // land / background
  ink: string; // labels
  muted: string; // secondary labels
  rule: string; // minor roads, hairlines
  accent: string; // major roads + admin borders
  water: string;
  green: string;
  building: string;
}

function readVar(root: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Read the current Civica palette from the document's CSS custom properties.
 * Call at recolor time (and whenever `data-theme` flips) so the map tracks the
 * live theme. `water`/`green`/`building` are the theme-aware cartographic tints.
 */
export function readCivicaMapPalette(
  isDark = document.documentElement.getAttribute("data-theme") === "dark",
): CivicaMapPalette {
  const root = document.documentElement;
  return {
    paper: readVar(root, "--color-bg", isDark ? "#16140f" : "#FAF7F2"),
    ink: readVar(root, "--color-text-primary", isDark ? "#ebe6d6" : "#0B1B2D"),
    muted: readVar(root, "--color-text-40", isDark ? "#8a8370" : "#6A7688"),
    rule: readVar(root, "--color-divider", isDark ? "#3d382d" : "#E4E1DC"),
    accent: readVar(root, "--color-accent", isDark ? "#d98a63" : "#B7512B"),
    // Cartographic tints (no exact token): warm-dark vs soft-light.
    water: isDark ? "#1a2028" : "#C4D2D0",
    green: isDark ? "#1a1c12" : "#E1E4D6",
    building: isDark ? "#211d14" : "#ECE5DA",
  };
}

const has = (id: string, ...needles: string[]) =>
  needles.some((n) => id.includes(n));

/**
 * Recolor an already-loaded MapLibre style in place to the Civica palette.
 * Matches OpenMapTiles/OpenFreeMap-positron layer ids by substring and is
 * defensive (per-layer try/catch) so an unexpected base style can't throw.
 * (OpenFreeMap fallback path only — the self-hosted style is pre-colored.)
 */
export function recolorCivicaMap(
  map: MapLibreMap,
  palette: CivicaMapPalette,
): void {
  const style = map.getStyle();
  const layers = style?.layers ?? [];
  for (const layer of layers) {
    const id = (layer.id || "").toLowerCase();
    try {
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", palette.paper);
      } else if (layer.type === "fill") {
        if (has(id, "water")) map.setPaintProperty(layer.id, "fill-color", palette.water);
        else if (has(id, "building")) map.setPaintProperty(layer.id, "fill-color", palette.building);
        else if (has(id, "park", "wood", "forest", "grass", "meadow", "garden", "cemetery", "pitch", "golf"))
          map.setPaintProperty(layer.id, "fill-color", palette.green);
        else map.setPaintProperty(layer.id, "fill-color", palette.paper);
      } else if (layer.type === "line") {
        if (has(id, "water", "river", "waterway"))
          map.setPaintProperty(layer.id, "line-color", palette.water);
        else if (has(id, "boundary", "admin")) {
          map.setPaintProperty(layer.id, "line-color", palette.accent);
          map.setPaintProperty(layer.id, "line-dasharray", [2, 1.5]);
        } else if (has(id, "motorway", "trunk", "primary", "major"))
          map.setPaintProperty(layer.id, "line-color", palette.accent);
        else if (has(id, "highway", "road", "street", "transport", "bridge", "tunnel", "rail"))
          map.setPaintProperty(layer.id, "line-color", palette.rule);
        else map.setPaintProperty(layer.id, "line-color", palette.rule);
      } else if (layer.type === "symbol") {
        map.setPaintProperty(layer.id, "text-color", palette.ink);
        map.setPaintProperty(layer.id, "text-halo-color", palette.paper);
        map.setPaintProperty(layer.id, "text-halo-width", 1.2);
      }
    } catch {
      /* layer doesn't support that paint prop — skip */
    }
  }
}

// ---------------------------------------------------------------------------
// Self-hosted Protomaps PMTiles path
// ---------------------------------------------------------------------------

/**
 * Build a `@protomaps/basemaps` Flavor tinted to the Civica palette. We start
 * from the shipped LIGHT/DARK flavor (so all ~60 keys have sane values) and
 * override the visually dominant surfaces to match the OpenFreeMap recolor:
 * paper land, one water tint, one green tint, muted rule roads with accent
 * majors/boundaries, ink labels with paper halos.
 */
export function buildCivicaFlavor(
  base: Flavor,
  palette: CivicaMapPalette,
): Flavor {
  const { paper, ink, muted, rule, accent, water, green, building } = palette;
  return {
    ...base,

    // Low-zoom Natural Earth landcover fills the earth at country-overview scale.
    // Flatten to paper (matches the recolor's paper land), keep vegetated classes
    // on the green tint so forests/parks still read faintly.
    landcover: {
      ...base.landcover,
      barren: paper,
      urban_area: paper,
      glacier: paper,
      grassland: green,
      farmland: green,
      scrub: green,
      forest: green,
    },

    // Land + background: one flat paper (matches the recolor's fill fallback).
    background: paper,
    earth: paper,
    pedestrian: paper,
    sand: paper,
    beach: paper,
    aerodrome: paper,
    military: paper,
    industrial: paper,
    hospital: paper,
    school: paper,
    zoo: paper,
    glacier: paper,

    // Green surfaces: one tint.
    park_a: green,
    park_b: green,
    wood_a: green,
    wood_b: green,
    scrub_a: green,
    scrub_b: green,

    // Water.
    water,

    // Buildings.
    buildings: building,

    // Boundaries — accent (admin borders read as terracotta hairlines).
    boundaries: accent,

    // Roads: minor = rule hairlines, major/highway = accent, casings = paper so
    // they read as thin single lines over land (like positron recolored).
    other: rule,
    minor_service: rule,
    minor_a: rule,
    minor_b: rule,
    link: rule,
    major: accent,
    highway: accent,
    railway: muted,
    pier: rule,
    runway: rule,

    minor_service_casing: paper,
    minor_casing: paper,
    link_casing: paper,
    major_casing_late: paper,
    major_casing_early: paper,
    highway_casing_late: paper,
    highway_casing_early: paper,

    tunnel_other_casing: paper,
    tunnel_minor_casing: paper,
    tunnel_link_casing: paper,
    tunnel_major_casing: paper,
    tunnel_highway_casing: paper,
    tunnel_other: rule,
    tunnel_minor: rule,
    tunnel_link: rule,
    tunnel_major: accent,
    tunnel_highway: accent,

    bridges_other_casing: paper,
    bridges_minor_casing: paper,
    bridges_link_casing: paper,
    bridges_major_casing: paper,
    bridges_highway_casing: paper,
    bridges_other: rule,
    bridges_minor: rule,
    bridges_link: rule,
    bridges_major: accent,
    bridges_highway: accent,

    // Labels: ink text on paper halos everywhere; secondary places muted.
    country_label: ink,
    state_label: muted,
    city_label: ink,
    city_label_halo: paper,
    state_label_halo: paper,
    subplace_label: muted,
    subplace_label_halo: paper,
    ocean_label: muted,
    roads_label_major: muted,
    roads_label_major_halo: paper,
    roads_label_minor: muted,
    roads_label_minor_halo: paper,
    address_label: muted,
    address_label_halo: paper,
  } satisfies Flavor;
}

/**
 * Layer ids from `@protomaps/basemaps` `layers()` we drop entirely: sprite-icon
 * layers with no text (`pois`, `roads_shields`, `roads_oneway`) and the z18
 * address labels. This removes all street-level clutter a country-overview map
 * doesn't want. Place labels (city / country names) are KEPT — we only strip
 * their icon so they render as text with no missing-sprite warning.
 */
const CIVICA_DROP_LAYER_IDS = new Set([
  "pois",
  "roads_shields",
  "roads_oneway",
  "address_label",
]);

/**
 * Build a complete MapLibre style for the self-hosted Protomaps basemap, tinted
 * to the Civica palette. Returns a `StyleSpecification` MapLibre can consume once
 * the `pmtiles://` protocol is registered (see CountryMap.tsx).
 */
export async function buildCivicaPmtilesStyle(
  palette: CivicaMapPalette,
  isDark: boolean,
): Promise<StyleSpecification> {
  const { layers, LIGHT, DARK } = await import("@protomaps/basemaps");
  const flavor = buildCivicaFlavor(isDark ? DARK : LIGHT, palette);
  const generated = layers(CIVICA_PMTILES_SOURCE, flavor, { lang: "en" });
  const styleLayers = generated
    .filter((l) => !CIVICA_DROP_LAYER_IDS.has(l.id))
    .map((l) => {
      // We ship no sprite. Strip icon-* layout props from surviving symbol
      // layers (the place labels) so they render as text only — no
      // missing-image warnings.
      const layout = l.layout as Record<string, unknown> | undefined;
      if (layout && "icon-image" in layout) {
        const nextLayout: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(layout)) {
          if (!key.startsWith("icon-")) nextLayout[key] = value;
        }
        return { ...l, layout: nextLayout } as typeof l;
      }
      return l;
    });

  return {
    version: 8,
    glyphs: glyphsUrlFor(BASEMAP_PMTILES_URL),
    sources: {
      [CIVICA_PMTILES_SOURCE]: {
        type: "vector",
        // MapLibre reads this via the registered `pmtiles://` protocol handler.
        url: `pmtiles://${BASEMAP_PMTILES_URL}`,
        attribution:
          '<a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>',
      },
    },
    layers: styleLayers,
  } satisfies StyleSpecification;
}
