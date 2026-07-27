# EXP-038 — approved English copy evidence

Status: approved copy applied; A4, T3, and T4 remain explicitly gated

Date: 2026-07-26

Fernando Baliño approved the prepared English copy bundle. This release applies
the unambiguous items, retains the evidence-supported Home independence label,
and leaves the three unresolved items unchanged.

## Source contract

- `content/about.md`
- `content/methodology-overview.md`
- `src/components/home/HomeGrid.tsx`
- `src/app/(reader)/methodology/page.tsx`
- `src/app/(reader)/country/[slug]/constitution/page.tsx`
- `src/app/governance-evidence/page.tsx`
- `src/app/licensing/page.tsx`
- `src/app/contact/ContactClient.tsx`
- `src/app/contact/page.tsx`
- `src/app/about/advisory-board/apply/ApplyClient.tsx`
- `src/app/about/advisory-board/apply/page.tsx`
- `src/lib/claims/public-claims.ts`
- `src/lib/research/project-disclosure.ts`

`scripts/validate-exp-038-copy.ts` fails if an approved fragment disappears,
the held A4 replacement is applied, or the retained independence label loses
its canonical disclosure.

## Browser evidence

`e2e/exp-038-copy-and-disclosure.spec.ts` passed six real-Chromium tests:

- Home and `/about#project-disclosure` at 1440×1000 and 390×844, in light and
  dark themes;
- affected reader routes at both viewport sizes; and
- no horizontal overflow or hard browser failures.

See `browser-check-2026-07-26.md` for the route matrix.

## Verification contract

- `npm run validate:exp-038-copy`
- `node --import tsx --test src/lib/ci/governance-evidence-copy.test.ts`
- `npm run validate:project-disclosure`
- `npm run validate:index-review-packet`
- `npm run validate:content-templates`
- `npm run validate:claims-docs`
- `npm run validate:index-change-control:run`
- `npm run typecheck`
- `npm run validate:design-tokens`

No independent review, endorsement, database migration, response-time
observation, or production correction-flow activation is claimed.
