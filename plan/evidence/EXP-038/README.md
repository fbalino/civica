# EXP-038 — approved English copy evidence

Status: approved copy applied; A4 and T3 are owner-resolved, and T4 now routes
to the shipped ATL-024 correction flow

Original review date: 2026-07-26
Correction-routing reconciliation: 2026-09-17

Fernando Baliño approved the prepared English copy bundle. This release applies
the approved items and retains the evidence-supported Home independence label.
The later owner decisions for A4 and T3 are recorded in the review plan. T4 is
an engineering reconciliation against ATL-024: the dedicated Atlas report flow
is already active, so Contact and the project disclosure now point corrections
to `/report-data-issue` while ordinary contact and GitHub bug reporting remain
available.

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
- `data/research/project-disclosure-v2.json` (current)
- `data/research/project-disclosure-v1.json` (preserved historical record)

`scripts/validate-exp-038-copy.ts` fails if an approved fragment disappears,
the correction route drifts from the dedicated Atlas report form, or the
retained independence label loses its canonical disclosure.

## Browser evidence

`e2e/exp-038-copy-and-disclosure.spec.ts` passed six real-Chromium tests:

- Home and `/about#project-disclosure` at 1440×1000 and 390×844, in light and
  dark themes;
- affected reader routes at both viewport sizes; and
- no horizontal overflow or hard browser failures.

The 2026-09-17 focused rerun additionally mocked the Contact acknowledgement so
the success-panel route could be checked without creating a live submission.
It also confirmed that the disclosure route and the unchanged GitHub bug path
render correctly. See `browser-check-2026-07-26.md` for the original route
matrix and `browser-check-2026-09-17.md` for the reconciliation run.

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

No independent review, endorsement, database write, or response-time
observation is claimed. Production correction-flow activation is supported by
the completed ATL-024 evidence rather than inferred from this copy change.
