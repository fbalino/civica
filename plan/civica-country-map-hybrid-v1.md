# Country Interactive Map — Hybrid (Civica Almanac 2D + Mapbox 3D) — v1

**Decision (2026-07-01):** Owner chose the **hybrid** map direction after comparing seven
options in a live demo. Every country page gets a default **interactive 2D map** styled to
the Civica almanac palette (free, no metering), plus an **"Explore in 3D"** button that opens
a **Mapbox** globe/3D view on demand (metered, but only on click → stays in the free tier).

Replaces the static Wikimedia locator-globe tile the owner called "kinda shit."

## Architecture

### Tile / engine strategy
- **Default 2D:** MapLibre GL JS + a **free** vector tile source (OpenFreeMap, OpenMapTiles
  schema, no API key), restyled at runtime to the Civica palette (light + dark) — the
  production version of the demo's `recolorCivica`. Abstracted behind one style/source config
  so we can later swap to **self-hosted Protomaps PMTiles on Cloudflare R2** (owned, ~$2/mo,
  no egress, no meter) — the production-hardening fast-follow.
- **3D:** Mapbox GL JS + `mapbox://styles/mapbox/standard` (3D buildings, globe, day/night).
  Loaded **only when the 3D modal opens** → minimal Mapbox loads. Token via
  `NEXT_PUBLIC_MAPBOX_TOKEN`. Production token should be **URL-restricted to civicaatlas.org**.
- Both libs are **dynamically imported inside the client component** (`await import(...)`) so
  they code-split out of the initial page bundle; MapLibre loads on masthead mount, Mapbox only
  on 3D open.

### Coordinates (the recon blocker — solved)
- No lat/lng exists in the DB. Instead of a migration/sync, **precompute a static lookup**
  `ISO3 → { bbox:[w,s,e,n], center:[lng,lat] }` from the same **world-atlas** Natural Earth
  TopoJSON the Atlas already uses (`countries-50m.json`), mapping numeric→ISO3 via the existing
  `ISO_NUMERIC_TO_ALPHA3` (`src/components/atlas/map-geom.ts:106`).
- Output: `src/lib/data/country-bounds.generated.json` + helper `src/lib/data/country-bounds.ts`
  (`getCountryBounds(iso3)`), with a small hand-authored supplement for microstates missing at
  50m (Singapore, Monaco, Malta, Bahrain, Vatican, etc.). Map `fitBounds(bbox)` for framing.
- Public-domain lineage (Natural Earth), deterministic, no runtime external dependency.

## Files

**New**
- `scripts/generate-country-bounds.ts` — one-off generator (topojson-client + world-atlas).
- `src/lib/data/country-bounds.generated.json` — committed output.
- `src/lib/data/country-bounds.ts` — `getCountryBounds(iso3)` + microstate supplement.
- `src/lib/map/civica-map-style.ts` — base style URL/source config + `recolorCivica(map, theme)`
  (ported from the demo, theme-aware light/dark).
- `src/components/factbook/CountryMap.tsx` — `"use client"`. Default 2D MapLibre map: dynamic
  import, load base style, recolor, `fitBounds`, react to `data-theme` changes, overlay an
  "Explore in 3D" button (only when a Mapbox token is configured). No-token / reduced-motion /
  SSR-safe fallbacks.
- `src/components/factbook/Country3DModal.tsx` — `"use client"`. Mapbox 3D/globe modal:
  dynamic import, Standard style, `fitBounds`/tilt/globe, day-night per theme, focus-trap + Esc.

**Modified**
- `src/components/factbook/FactbookHeaderStrip.tsx` — replace the static MAP tile (~419–480)
  with a live `CountryMap` (framed to the country); keep PHOTOS as-is. Pass `bounds`.
- `src/app/(reader)/country/[slug]/layout.tsx` — resolve `getCountryBounds(iso3)` and pass to
  the header strip.
- `.env.example` — document `NEXT_PUBLIC_MAPBOX_TOKEN`.
- `package.json` — deps `maplibre-gl`, `mapbox-gl`; devDeps `@types/mapbox-gl`,
  `world-atlas`, `topojson-client`, `@types/topojson-client`.

## Design-system discipline
- Map style colors are the one sanctioned place for literal color values (a style spec is data,
  like `DesignSystemSwatch`), but they must be the Civica token *values* (paper `#FAF7F2`, ink
  `#0B1B2D`, terracotta `#B7512B`, dark variants) — kept in one `civica-map-style.ts` constant.
- The tile/modal chrome (buttons, modal frame, labels) uses `var(--*)` tokens + existing
  primitives; no `<style>` blocks, no magic numbers.
- Hydration: no `Math.random`/unrounded trig in SSR output; the map mounts client-side only.
- Motion: respect `useReducedMotion` (no auto-fly/spin when reduced).

## Build order
1. Install deps (single npm pass — avoid concurrent installs).
2. Generate country bounds (delegated) → JSON + helper, verify coverage ≥ all DB countries.
3. `civica-map-style.ts` (style config + recolor).
4. `CountryMap.tsx` (2D default) → wire into masthead → verify locally.
5. `Country3DModal.tsx` (Mapbox) → wire the button → verify (with token).
6. Env: `.env.local` + Vercel `NEXT_PUBLIC_MAPBOX_TOKEN` (URL-restricted for prod).
7. Visual verification (light/dark, several countries, 3D open), then commit + deploy.

## Deferred / follow-ups
- Self-host Protomaps PMTiles on Cloudflare R2 (needs CF auth from owner) → swap base source.
- Optional: label capitals/major cities; a "reset view" control; share-view deep link.
