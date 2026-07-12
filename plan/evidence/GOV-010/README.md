# GOV-010 — Reviewer shortlist ranking

Completed 2026-07-11.

## Outcome

`civica-reviewer-ranking/v1` scores all 24 verified core-lane candidates against a frozen 100-point rubric: lane expertise (25), exact task fit (25), independence (15), conflict manageability (10), methodological/geographic perspective (15), public availability signal (5), and communication burden (5).

Availability and communication burden remain unknown for every candidate because nobody has been contacted and no public evidence establishes willingness for this exact task. Both axes receive zero without becoming negative findings. The maximum observable pre-contact score is therefore 90. Ties resolve through expertise, fit, independence, then stable candidate ID.

Each lane retains three proposed primaries, three alternates, and two reserves. The ordering balances source-project implementation with non-affiliated criticism; final overlapping judgments still require a non-affiliated reviewer. "Proposed primary" is not an invitation. Owner approval is queued and GOV-016 still blocks contact.

## Verification

- `npm run generate:reviewer-ranking`
- `npm run validate:reviewer-ranking`
- `npx eslint src/lib/research/reviewer-ranking.ts src/lib/research/reviewer-ranking.test.ts scripts/generate-reviewer-ranking.ts scripts/validate-reviewer-ranking.ts`
- `npx tsc --noEmit`
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`

Semantic hash: `641abae9b21590b0eac24cba19a99214d4784ee90d6c4c3469e112f40996487d`.

No candidate was contacted and no private contact data or inferred availability entered scoring.
