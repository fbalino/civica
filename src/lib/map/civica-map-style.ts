/**
 * Civica map cartography — base source + runtime recolor to the design tokens.
 *
 * The default country-page map is MapLibre GL rendering a FREE vector-tile base
 * (OpenFreeMap, OpenMapTiles schema, no API key), restyled at runtime to the
 * Civica palette so it reads like the almanac instead of a stock basemap. This
 * is the production version of the map-demo's `recolorCivica`.
 *
 * Palette is READ FROM THE LIVE CSS CUSTOM PROPERTIES (`--color-bg`,
 * `--color-text-primary`, `--color-divider`, `--color-accent`, …) at recolor
 * time, so the map automatically matches the site's current light/dark theme
 * and any future palette change — no hardcoded brand hexes here. The only
 * literal colors are the three cartographic tints (water / park / building)
 * that have no exact design token; those are the sanctioned map-data exception
 * (like `DesignSystemSwatch`), kept here in one place and theme-aware.
 *
 * Swap `CIVICA_MAP_BASE_STYLE` to a self-hosted Protomaps PMTiles style later
 * (owned, no meter) without touching the components — see
 * plan/civica-country-map-hybrid-v1.md.
 */
import type { Map as MapLibreMap } from "maplibre-gl";

/** Free, keyless OpenMapTiles vector base. One config point for the tile source. */
export const CIVICA_MAP_BASE_STYLE =
  "https://tiles.openfreemap.org/styles/positron";

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
