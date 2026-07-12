# GOV-006 — advisory-board remit and independence

Completed 2026-07-11.

## Outcome

`civica-advisory-board-charter/v1` is the public and machine-readable charter for Civica Atlas's planned advisory board. The charter covers:

- purpose and five expertise lanes;
- advisory-only authority, no publication veto, and Fernando Balino's final accountability;
- 24-month terms, one possible renewal, and approximately 8–16 hours of ordinary annual service;
- confidentiality, publicity, conflict disclosure, recusal, and removal;
- unpaid standing service and separately scoped, optional, outcome-independent paid reviews;
- resignation and removal procedure;
- consent for names, affiliations, quotations, and review publication; and
- an explicit rule that membership validates neither Civica as a whole nor any claim, dataset, method, release, or later change.

The public roster says no members have been appointed. Applications and invitations do not imply membership, review, or endorsement.

## Artifacts

- `src/lib/research/advisory-board-charter.ts`
- `data/research/advisory-board-charter-v1.json`
- `src/app/about/advisory-board/page.tsx`
- `src/lib/research/advisory-board-charter.test.ts`
- `scripts/validate-advisory-board-charter.ts`

## Verification

- `npm run validate:advisory-board-charter`
- `npm run validate:public-claims`
- `npm run validate:design-tokens`
- `npx eslint ...`
- `npx tsc --noEmit`
- `npm run validate:claims-docs` (846 tests; claim marker repaired before final run)
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`
- Local browser: `/about/advisory-board`, desktop light/dark, charter and empty roster visible, zero console errors
