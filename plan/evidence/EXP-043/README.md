# EXP-043 — restore country-engraving disclosure

Completed 2026-07-12.

## Outcome

The country-reference header redesign retained the licensing link but shortened the disclosure label from `Editorial engraving` to `Engraving`. The independent editorial-illustration validator failed the production build. The shared `FactbookHeaderStrip` again renders the required label whenever an engraving exists, beside the existing `AI-assisted illustration` link to `/licensing#imagery`.

## Verification

- `npm run validate:editorial-illustrations`
- `npm run validate:design-tokens`
- `npx eslint src/components/factbook/FactbookHeaderStrip.tsx` (zero errors; two pre-existing `no-img-element` warnings)
- `npm run build`
