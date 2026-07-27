# ATL-032 — government-type/regime trajectories are historically honest

Completed 2026-07-12. This was primarily an AUDIT that confirmed the public
surfaces already satisfy the "current cross-section" branch of the Done-when,
plus a fixture that locks it (and the BR/CGV reference year).

## Audit findings
- **The only "long-run trajectory" surface is not public.** The government-type
  explorer that draws a per-family average-Index-score "long-run trajectory"
  over quarters (`src/components/ci/GovernmentTypesAccordionExplorer.tsx`) is
  orphaned — its page `src/app/(reader)/civica-index/government-types/page.tsx`
  `redirect()`s to `/civica-index`, and no live `.tsx` imports it (confirmed by
  grep: only a stylesheet and the numeric-claims registry reference the name).
  So no public surface asserts a regime trajectory built from a single
  cross-section classification. (The component is preserved research code per
  the 2026-05-02 peer-grouping resolution; it is simply not exposed.)
- **The live regime surface is an explicit point-in-time cross-section.**
  `src/components/GovernmentTaxonomyBlock.tsx` renders the regime as
  `{regimeTypeLabel} · {regimeYear}` — stamped with its reference YEAR — and
  uses no trajectory / over-time / long-run language.
- **BR/CGV is a single cross-section reference year (2022), never a range.**
  `BJORNKSKOV_RODE_CROSS_SECTION_REFERENCE_YEAR === 2022` (DAT-025 corrected the
  earlier spurious 2025). The derivation stamps that year through
  `buildGovernmentClassification`/`deriveRegimeTypeCgv`, and stamps `null` when
  no year is supplied — it never fabricates a current year to imply currency.

## What shipped
`src/lib/government-taxonomy/__tests__/atl-032-regime-trajectory-honesty.test.ts`
— 6 source-backed + pure-function fixtures locking all of the above (runs under
`npm test`, which is a child of the claims-docs build gate). No production code
change was needed or made: the public surfaces were already honest, and editing
the non-public dead component would add churn without changing any public claim.

## Verification
- `node --import tsx --test .../atl-032-regime-trajectory-honesty.test.ts` → 6/6.
- `npx tsc --noEmit` clean.

## Note
The Done-when's alternative branch ("each point joins a score/indicator release
to the classification valid for that year with composition and n") is not
required because there is no public per-year regime trajectory to join — the
only such surface is non-public. If the explorer is ever re-exposed, that branch
would then apply.
