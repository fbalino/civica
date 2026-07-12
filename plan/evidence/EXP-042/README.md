# EXP-042 — Every rankings column names its backing source

**Commit:** this commit (feat(design): name the source on every rankings column (EXP-042)).

## What changed
- `ColumnMeta` in `src/app/rankings/RankingsMatrix.tsx` now renders the
  publisher name (via the canonical `sourceLabel()` map) beside the existing
  provenance dot in each metric column header.
- A column whose cells do not all share one source now shows a visible
  warn-toned flag: `mixed · mostly <dominant source>`.
- The rankings info banner explains the one-source-per-column rule — ranking
  is only meaningful within a single publisher's methodology — and points to
  country pages for cross-source reconciliation.
- New tokens-only `.rankings-col-source` / `--mixed` styles in editorial.css.
- Fixed a latent label gap the new UI exposed: source id `unesco_uis` was
  missing from `SOURCE_NAMES` and rendered as a raw id; now "UNESCO UIS".

## Browser verification (dev server, live)
Column headers at 1440x900: Population/GDP (PPP)/GDP per capita/Area/Life
expectancy → "CIA World Factbook"; HDI → "UNDP HDI"; Literacy → "UNESCO UIS";
Median age → "mixed · mostly CIA World Factbook" in the warn tone — a real
mixed-source column that was previously invisible. Note visible above the
table; dark-theme color resolves; no console errors.

## Commands
- `npm run validate:design-tokens` — pass (baseline unchanged at 410).
- `node --import tsx --test src/lib/design/editorial-button-guard.test.ts` — 2/2 pass.
- `npx tsc --noEmit` — clean; `npx eslint` on touched files — clean.

## Limitations
- The median-age mixed-source column is now *disclosed*, not resolved;
  deliberately re-sourcing ranking metrics to preferred publishers (UN WPP
  population, IMF/World Bank GDP) is data work owned by ATL-001/ATL-002.
