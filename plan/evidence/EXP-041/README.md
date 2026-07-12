# EXP-041 — /governance-evidence gets the flagship landing and register

**Commit:** this commit (feat(design): give governance evidence its flagship landing (EXP-041)).

## What changed
- Visiting `/governance-evidence` with no `?country=` (or an unknown slug) now
  renders a landing built on the canonical `PageHero` shell (owner mandate
  2026-07-06: one hero for every browse/landing surface) with the country
  search in the hero slot, a how-to-read section reusing the canonical
  `Banner`, and the full sovereign-state index. The hardcoded Japan default is
  gone; an invalid slug lands on the selector instead of a 404.
- `?country=<slug>` deep links keep the existing country view, which retains
  the evidence table, release/citation line, rights links, and rights-safe
  JSON download, and gains an "All countries" link plus a landing link in the
  eyebrow.
- New design-system primitive `.editorial-index-grid` (tokens only) was added
  to `src/app/editorial.css`, demoed on `/design-system`, documented in
  `DESIGN.md`, and consciously allowlisted as link-only in
  `src/lib/design/editorial-button-guard.test.ts` — the closed-set protocol
  for a missing pattern, instead of a page-local approximation.
- The country count in the landing heading resolves from runtime state with a
  nonnumeric fallback ("Sovereign states.") per the registered-claims rule.

## Browser verification (dev server, live)
- Landing 1440x900: canonical hero (eyebrow rules, serif H1, dek, rounded
  search) over the shared engraving + scrim; index renders 194 links in 4
  columns; screenshot reviewed.
- Deep link `?country=japan`: H2 "Japan", evidence table present, back links
  present. Invalid `?country=not-a-country`: landing renders.
- Mobile 390x844: index collapses to 1 column, no horizontal overflow.
- Dark theme attribute applied during checks; console error log empty.

## Commands
- `node --import tsx --test src/lib/design/editorial-button-guard.test.ts` — 2/2 pass.
- `npm run validate:design-tokens` — pass (baseline unchanged at 410).
- `npx tsc --noEmit` — clean. `npx eslint` on touched pages — clean.

## Limitations
- Screenshots reviewed live, not persisted (QA-009 harness pending).
- Landing copy is first-pass; EXP-038 owns the English-first copy-quality
  review of Governance Evidence explainers.
