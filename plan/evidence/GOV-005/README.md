# GOV-005 — release and correction authority

Completed 2026-07-11.

## Outcome

`civica-release-correction-authority/v1` supplements the existing CLM-016 correction policy with named authority and frozen-release governance. Fernando Baliño is the approver for releases, methodology versions, corrections, retractions, supersessions, emergency suppression, and restoration after applicable gates pass.

The policy closes:

- major, minor, patch, and beta triggers;
- emergency containment, review, evidence preservation, and restoration;
- prospective corrections, bidirectional supersession, retraction tombstones, and security-sensitive payload restriction;
- new-version DOI relationships through `IsNewVersionOf` and `IsPreviousVersionOf`;
- five public notice locations;
- correction and contact report routes;
- one evidence-bearing reconsideration and independent appeal handling when the owner is conflicted; and
- three deterministic, no-write tabletop incidents covering material error, methodology failure, and restricted-payload exposure.

## Verification

- `npm run validate:release-authority`
- `npm run validate:content-templates`
- `npm run validate:policy-surface`
- `npm run validate:claims-docs` (844 tests)
- `npx tsc --noEmit`
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`
- Local browser: `/policies#authority`, desktop light/dark, authority/DOI/report/appeal content visible, zero console errors
