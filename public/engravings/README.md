# Engravings

Antique-atlas illustration assets for the almanac design language.

- `hero.webp` — homepage hero illustration (rendered as the `.home-hero` background).
- `pages/*.webp` — top-level page hero/feature engravings (About, Countries,
  Atlas, Compare, Index, Methodology, The Record).
- `spot-*.webp` — reusable section/feature motifs (column, globe, compass, ship, laurel, mountains).
- `countries/<iso3>.webp` — per-country landmark hero for the factbook masthead
  (e.g. `usa.webp`, `jpn.webp`). The country page renders it as a full-bleed backdrop
  with the header overlaid; countries without art render no banner.

## Format / workflow

Source exports from Codex are large PNGs (~4–5 MB). They are converted to **WebP**
(`cwebp -q 80 -resize 1500 0`) — ~10× smaller, visually identical — before committing.

The factbook lookup **prefers `<iso3>.webp` but falls back to `<iso3>.png`**, so a raw
PNG dropped into `countries/` appears immediately; convert it to WebP (and delete the
PNG) before committing so the repo and page loads stay light. Generate new art with the
prompts in `~/civica/plan/codex-engraving-prompts.md`; keep one consistent sepia
engraving treatment across the set. In dark mode the engravings are inverted in CSS
(no separate dark asset needed).
