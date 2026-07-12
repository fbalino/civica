# Self-hosted basemap tiles — v1

The default 2D country-page map serves its own Protomaps basemap from Vercel
Blob, read directly by the browser over HTTP range requests. No tile server, no
per-request meter. OpenFreeMap stays wired as the automatic fallback.

## What runs where

- **Archive:** one `.pmtiles` planet extract from the Protomaps daily build,
  hosted on a public Vercel Blob store (`civica-tiles`,
  `store_ZOTsIIAap0ghapm5`). MapLibre's `pmtiles` protocol reads byte ranges of
  this single file client-side, so only the tiles a given view needs are ever
  transferred.
- **Glyphs:** the three fonts the generated style references
  (`Noto Sans Regular`, `Noto Sans Medium`, `Noto Sans Italic`) — 768 PBF range
  files, ~11 MB total — live next to the archive under
  `.../basemap/fonts/{fontstack}/{range}.pbf`. Sourced from
  `protomaps/basemaps-assets` (OFL).
- **No sprite:** the POI, road-shield, and address-label layers (the only ones
  needing icon sprites) are dropped from the Civica style, so there is no sprite
  dependency. Those layers add street-level clutter a country-overview map does
  not want anyway.
- **Style:** generated at runtime from `@protomaps/basemaps` `layers()` with a
  Civica-tinted `Flavor` built from the live design tokens (paper / ink / rule /
  accent + the water / green / building cartographic tints), in
  `src/lib/map/civica-map-style.ts`. Light and dark both come from the same
  token read, so the map tracks `data-theme` and rebuilds its style on theme
  flips.

## Chosen zoom and size

- **maxzoom = 9.** The map only ever frames whole countries with `fitBounds`.
  Measured framing zoom lands every normal country in the z2–z10 band (Russia
  ~z2, contiguous USA ~z3, Malta / Singapore / Barbados ~z10). z9 base tiles
  cover that natively; the handful of true microstates (Vatican, Monaco, Nauru)
  reach their framing through MapLibre's vector overzoom, which stays crisp for
  ~2 levels.
- **Map max zoom is capped at 11** in the self-hosted path
  (`CIVICA_PMTILES_MAX_ZOOM`) so a user dragging the zoom control can never scroll
  past available detail into blur.
- **File size: 1,551,503,520 bytes (~1.44 GiB / 1.55 GB).** Well under the ~5 GB
  target. Measured alternatives from the same build: z8 = 549 MB, z10 = 3.7 GB.
  z9 is the sweet spot — full country coverage, roughly a third of z10's size.

## URLs

- Archive:
  `https://zotsiiaap0ghapm5.public.blob.vercel-storage.com/basemap/civica-basemap-20260702-z9.pmtiles`
- Glyphs:
  `https://zotsiiaap0ghapm5.public.blob.vercel-storage.com/basemap/fonts/{fontstack}/{range}.pbf`
- Source build: `https://build.protomaps.com/20260702.pmtiles` (Protomaps daily,
  planet, z0–15, ODbL OpenStreetMap + Natural Earth).

The archive URL is the env var `NEXT_PUBLIC_BASEMAP_PMTILES_URL`. The glyphs URL
is derived from it (same folder + `/fonts/...`), so a host move is a single URL
swap. Set in `.env.local`, documented in `.env.example`, and set on Vercel for
production + preview.

## Range-request verification

Vercel Blob honors HTTP range requests with open CORS:

- `HTTP/2 206`, `accept-ranges: bytes`, `content-range: bytes 0-16383/…` on a
  partial GET, exact byte count returned.
- `access-control-allow-origin: *` — the `pmtiles` protocol fetches cross-origin
  from `civicaatlas.org` without a proxy.
- `cache-control: public, max-age=31536000` — the CDN caches ranges; the
  date-stamped filename makes the URL effectively immutable.

## Fallback behavior

`isPmtilesEnabled()` is true only when `NEXT_PUBLIC_BASEMAP_PMTILES_URL` is set.

- **Set →** `CountryMap` registers the `pmtiles://` protocol, builds the
  pre-colored Protomaps style, caps max zoom, and renders the owned basemap.
- **Unset →** unchanged legacy path: OpenFreeMap positron recolored in place by
  `recolorCivicaMap`.
- If building the self-hosted style throws (e.g. archive unreachable at mount),
  `CountryMap` degrades to OpenFreeMap for that mount. Tile/network errors are
  swallowed rather than thrown, as before.

The Mapbox "Explore in 3D" path is untouched and independent.

## Monthly cost estimate (Vercel Blob)

Vercel Blob bills roughly \$0.023 / GB-month stored plus data transfer.

- **Storage:** ~1.55 GB archive + ~0.01 GB glyphs ≈ 1.56 GB → **~\$0.036 / mo**.
- **Transfer:** range reads mean a country view pulls only a few hundred KB to a
  few MB, not the whole file. Even at, say, 50k map views/mo × ~2 MB average
  (generous — the header, directory, and a country's worth of z0–9 tiles) ≈
  100 GB egress. Blob transfer is the dominant line; at the current fast-tier
  rate this is on the order of a few dollars/month, scaling with traffic. Cold,
  the whole thing is effectively free.
- The CDN's 1-year cache on both archive ranges and glyphs keeps repeat views
  from re-hitting origin.

Net: cents/month today, a few dollars/month at real traffic — versus
OpenFreeMap's zero-dollar-but-third-party dependency.

## Moving to Cloudflare R2 later

R2 is the eventual target (zero egress) once it's enabled on the account
(currently blocked — CF error 10042). The move is a URL swap, not a code change:

1. Copy the same `.pmtiles` archive and the `fonts/` tree to an R2 bucket with a
   public custom domain (or `r2.dev`), CORS `*`, range requests on (R2 supports
   them natively).
2. Update `NEXT_PUBLIC_BASEMAP_PMTILES_URL` to the R2 URL in `.env.local` and on
   Vercel, then redeploy. The glyphs URL follows automatically (same-folder
   derivation).

No component or style code changes — the abstraction point is the one env var.

## Refresh cadence

The archive is a dated snapshot (`…-20260702-…`). To refresh: run
`pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles out.pmtiles
--maxzoom=9`, upload under a new date-stamped pathname, re-upload glyphs only if
the referenced font set changes, point the env var at the new URL, redeploy. The
old archive can be deleted after the new URL is live. Quarterly is plenty for a
basemap.

## Files

- `src/lib/map/civica-map-style.ts` — env flag, Civica `Flavor` builder, PMTiles
  style builder, glyphs-URL derivation (plus the unchanged OpenFreeMap recolor).
- `src/components/factbook/CountryMap.tsx` — registers the `pmtiles` protocol,
  selects style, caps max zoom, rebuilds style on theme flip; OpenFreeMap
  fallback preserved.
- `.env.local` / `.env.example` — `NEXT_PUBLIC_BASEMAP_PMTILES_URL`.
- `package.json` — added `pmtiles` and `@protomaps/basemaps`.
