# QA-022 — remaining-work owner handoff

Completed 2026-07-25.

The canonical owner runbook is
`plan/OWNER-ACTION-RUNBOOK-2026-07-25.md`. It translates all 61 unchecked tasks
into direct owner decisions, professional or qualified-human reviews,
staging/external-authority work, non-substitutable blockers, and downstream
dependency chains.

The runbook links every actionable row to its prepared decision deck, evidence
packet, image, protocol, or browser route. Downstream work with no packet is
labelled explicitly so a missing artifact cannot be mistaken for an instruction
to search or improvise.

The handoff names roles rather than inventing people. It specifies what to
send, what evidence to request, and when Codex may resume. It does not claim
contact, approval, review, production authority, deployment, paid activity, or
elapsed observation.

Verification:

- `npm run validate:remaining-work-report`
- `node plan/tools/validate-master-plan.mjs`
- `npm run generate:readiness-reports`
- `npm run validate:readiness-reports`
- `npm run validate:operations-readiness`
