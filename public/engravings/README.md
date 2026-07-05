# Engravings

Antique-atlas illustration assets for the almanac design language.

- `hero.webp` — homepage hero illustration (rendered as the `.home-hero` background).
- `pages/*.webp` — top-level page hero/feature engravings (About, Countries,
  Atlas, Compare, Index, Methodology, The Record).
- `hero-dark.webp`, `pages/*-dark.webp`, and `spot-*-dark.webp` — dark-mode
  nighttime companions with vignettes that dissolve into Civica's dark
  background rather than relying on CSS inversion.
- `trusted-source-logos.webp` — generated raster source-logo strip for the
  upper footer trust band.
- `trusted-source-logos-dark.webp` — exact transparent recolor of the source-logo
  strip for dark mode; keep this deterministic so source names remain legible.
- `spot-*.webp` — reusable section/feature motifs (column, globe, compass, ship, laurel, mountains).
- `countries/<iso3>.webp` — light-mode per-country landmark hero for the factbook
  masthead (e.g. `usa.webp`, `jpn.webp`).
- `countries/<iso3>-dark.webp` — dark-mode nighttime country hero, same dimensions
  and landmark vocabulary, with edges vignetted into Civica's dark background.
- `territories/<slug>.webp` — light-mode per-territory or special-jurisdiction
  hero art for pages that intentionally have no `jurisdictions.iso3`.
- `territories/<slug>-dark.webp` — dark-mode companion art for those
  slug-keyed territory heroes. Prefer a distinct nighttime composition rather
  than a recolor when generating new assets.

## Format / workflow

Source exports from Codex are large PNGs (~4–5 MB). They are converted to **WebP**
(`cwebp -q 80 -resize 1500 0`) — ~10× smaller, visually identical — before committing.

The factbook lookup **prefers `<iso3>.webp` but falls back to `<iso3>.png`** for the
light asset, so a raw PNG dropped into `countries/` appears immediately; convert it to
WebP (and delete the PNG) before committing so the repo and page loads stay light.
Dark-mode country art must be saved as `<iso3>-dark.webp`; generate it as a real
nighttime engraving with a vignette that dissolves into the dark theme background
rather than relying on CSS inversion.

Territory art follows the same WebP format and dimensions, but is saved under
`territories/` using the country-page slug. Do not add ISO3 codes to
ISO2-only territory rows just to make art resolve; those rows stay outside the
ISO3 reconciliation and scoring pipeline by design.
