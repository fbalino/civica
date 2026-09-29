# CLM-020 verification after the change-control record

This file is not Index change-control evidence, so it can record results that
exist only after `publisher-attribution-2026-09-29`
(`civica-index-publisher-attribution-v64`) was appended, and the controller's
browser checks. Pre-record results are in `README.md`.

| Command (worktree, 2026-09-29, `DATABASE_URL` unset) | Exit | Result |
|---|---|---|
| `npm run generate:index-change-control -- --metadata=plan/evidence/CLM-020/index-change-control-metadata.json` | 0 | Appended `civica-index-pulse-voter-dropout-counter-v63` → `civica-index-publisher-attribution-v64`; categories input and presentation; 10 changed protected files. |
| `npm run validate:index-change-control:run` | 0 | Binds 118 protected files; reran all 9 declared validations, including `validate:claims-docs` (all 17 checks pass across the seven categories; its `npm test` child ran 2,345 tests: 2,342 pass, 0 fail, 3 skipped) and `validate:publisher-attribution`. |
| `npm run build:ci` (credential-free: `.env.local` moved out of the worktree for the run and restored) | 0 | `build:core` ran every validator, including `validate:claims-docs` with the new `publisher-attribution` child (self-proof with 11 seeded mutations, then a pass over 905 source files), and `next build` completed. |
| `npm run validate:ci-workflow` | 0 | CI contract unchanged. |

## Browser checks (controller)

Local development server on this branch, 2026-09-29, reading the production
database; only page routes were requested (no local API routes).

- `uruguay-rankings-desktop-light.jpg`: `/country/uruguay/civica-data`
  Rankings has two rows, V-Dem Liberal Democracy Index 0.769 (observation
  year 2024) and Freedom House status "Free · Freedom in the World 2024"
  (observation year 2023), each with the chip "Civica release · 2024 Q4". No
  "/100", "Global rank", or "as of" text appears on the page.
- `uruguay-freedom-house-infotip-desktop-light.jpg`: clicking the info button
  opens the note explaining that Civica applied Freedom House's published
  status rule to the stored ratings. The button has the accessible name "How
  this status was determined" and takes keyboard focus. The screenshot caught
  the tooltip mid-fade; its computed background is the opaque ink token.
- `japan-conditions-mobile-dark.jpg`: `/country/japan/civica-data` at 375px in
  dark theme shows "92 / 100" and "91.6 / 100" each with a "Civica
  calculation" chip and info note, above the publisher inputs 0.92 and 1.34.
  Page width equals viewport width (no horizontal overflow).
- Observed, not changed here: the Conditions input rows print raw unit codes
  such as `percent_labor_force`, `index_0_1`, and `index_1_5_inverted` to
  readers. Left for the screen-by-screen review.

## Review follow-up: gaps in the permanent check (2026-09-29)

A review found two regressions that passed every gate; F13 in
`follow-ups.md` describes them and what remains a review rule. This change
adds `src/components/scores/scores-rankings-closure.test.ts` and the scan
rules `scale-suffix-unregistered` and `scale-suffix-allowance-stale`. It
changes no Index-protected file and no pinned evidence file, so it needs no
new Index change-control record: `publisher-attribution-2026-09-29` still
binds the protected files.

| Command (worktree, 2026-09-29, `DATABASE_URL` unset) | Exit | Result |
|---|---|---|
| Scratch copy with the review's static "Freedom House score" row (83) added to `ScoresAndRankings.tsx`: `node --import tsx --test src/components/scores/scores-rankings-closure.test.ts src/components/scores/scores-rankings.test.ts` | 1 | The closure test fails 2 of its 3 tests ("the table body has 3 rows; expected one per score row (2)"); the pinned contract test still passes 4 of 4. Four more edits of the component (a fourth cell, a rank beside the V-Dem value, a number in a measure label, a number in the release chip) each fail the closure test; the contract test catches only the rank beside the value. |
| `npx tsx scripts/validate-publisher-attribution.ts --source-override=<new component>=<review's badge file>` | 1 | `scale-suffix-unregistered` for the badge ("/100)"). The same override passed before this change. |
| `npm run validate:publisher-attribution -- --update-baseline` | 0 | Baseline `publisher-attribution-baseline/v2` lists the 7 scale-suffix allowances. |
| `npm run validate:publisher-attribution` | 0 | Self-proof with 16 seeded mutations, then a pass over 905 source files. |
| `node --import tsx --test` on the publisher-attribution, closure, contract, golden, Conditions attribution, and Conditions public-release suites | 0 | 35 tests pass. |
| `npm run validate:claims-docs` | 0 | All checks pass; its `npm test` child ran 2,352 tests: 2,349 pass, 0 fail, 3 skipped. |
| `npm run validate:index-change-control`, then `npm run validate:index-change-control:run` | 0, 0 | Binds 118 protected files; reran all 9 declared validations. |
| `npm run validate:atlas-surface-data-matrix` (regenerated), `npm run validate:verification-matrix` | 0 | The Rankings row lists the closure test. |
| `npm run validate:module-coverage` | 0 | publisher-attribution: lines 94.28, branch 82.83, functions 93.68. |
| `npm run typecheck`, `validate:lint`, `validate:design-tokens`, `validate:secrets`, `validate:doc-references`, `validate:doc-sources` | 0 | |
| `npm run build:ci` (credential-free: `.env.local` moved out of the worktree for the run and restored) | 0 | `build:core` ran the gate with its 16-mutation self-proof, and `next build` completed. |
