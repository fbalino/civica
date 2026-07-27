# EXP-044 — design-composition drift repair

Completed 2026-07-25.

## Outcome

- `/country` now composes the canonical `PageHero` with its approved centered
  browse variant.
- The country directory reads A–Z in document order, with responsive
  per-letter grids and a visible separator between every name and status.
- Governance Change uses one `DataTable` scroll surface; country row headers
  are left aligned, regular weight, and share borders, padding, and hover
  treatment with every cell.
- Four outer page-width roles and named internal track roles now drive
  Methodology, country tabs, Constitution, and Record layouts.
- CI runs the token, pattern-registry, and new composition contracts.

Pulse Changelog was deliberately not changed.

## Browser evidence

The real local Civica app was checked against its current database on desktop,
tablet, and mobile. The repeatable browser contract and optional screenshot
capture live in `e2e/exp-044-design-composition.spec.ts`.

Named captures in this folder cover the centered country hero and the country
directory at desktop/mobile in both themes, plus the Governance Change table
on desktop in both themes. Browser geometry also confirmed:

- Methodology: 1200px shell, 220px navigation rail, 800px body;
- country Factbook: reference shell with 240px and 280px desktop rails, then
  the shared 200px compact rail at tablet width;
- country Constitution: reference shell with a 240px desktop rail and the same
  200px compact tablet rail;
- Constitution Explorer: 180px outline and 360px context track; and
- Record detail: 200px / 680px / 200px internal tracks.

The country hero contract also measures a non-zero rendered gap between direct
region-chip children, so a semantic wrapper cannot silently collapse the
canonical chip spacing again.

## Verification

- `npm run validate:design-composition`
- `npm run validate:design-tokens`
- `npm run validate:ui-pattern-map`
- `npm run validate:alt-text-policy`
- `npm run validate:ci-workflow`
- `npm run typecheck`
- targeted ESLint for changed TypeScript/TSX
- Governance Change unit tests
- `E2E_BASE_URL=http://localhost:3002 EXP044_CAPTURE_DIR=plan/evidence/EXP-044 npm run test:e2e -- e2e/exp-044-design-composition.spec.ts --project=chromium --workers=1`
- `npm run run:readiness-reports -- --gate=G4 --execute`
- `git diff --check`

The full visual-baseline promotion and blind audit remain separate qualified
human gates under EXP-025/QA-013 and EXP-028. This task closes the confirmed
defects and their mechanical recurrence paths; it does not fabricate those
later reviews.
