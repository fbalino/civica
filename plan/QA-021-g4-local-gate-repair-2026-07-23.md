# QA-021 — G4 local gate repair

## Discovery

The 2026-07-23 fixed G4 runner passed master-plan integrity, the verification
matrix, the full unit suite, and typecheck, but failed lint and the production
build. The failures are locally repairable and therefore invalidate the prior
claim that no agent-executable work remains.

## Scope

1. Add the required checked, zero-write preflight records for migrations
   `0046_little_mulholland_black`, `0047_atlas_data_error_reports`, and
   `0048_entity_name_forms`.
2. Repair every ESLint error without broad formatting or unrelated behavior
   changes. Existing warnings may remain under the repository's documented
   lint posture.
3. Preserve the unrelated typography, licensing, country-header, image-trial,
   and agent-context work already present in the checkout.
4. Rerun the exact G4 command set and retain the runtime result in task
   evidence. A passing command matrix does not override open human, external,
   production, or calendar-bound checklist gates.

## Acceptance

- `npm run validate:migration-preflight`
- `npm run lint`
- `npm run build`
- `npm run run:readiness-reports -- --gate=G4`
- `node plan/tools/validate-master-plan.mjs`
- `npm run validate:remaining-work-report`
- `npm run generate:readiness-reports`
- `npm run validate:readiness-reports`
- `npm run validate:operations-readiness`
- `git diff --check`
