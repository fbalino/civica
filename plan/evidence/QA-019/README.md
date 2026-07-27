# QA-019 — Rollback/forward-fix and correction evidence

Status: isolated technical rehearsal complete; external status record and owner sign-off remain pending.

The rehearsal used one deterministic marker mismatch in a protected Preview backed only by the disposable QA-018 Neon child branch. The deliberately bad commit and its distinct Preview were detected, contained, and forward-fixed without reversing migrations, deleting evidence, touching production, calling a paid model, or merging the temporary branch into Main.

The recovered commit received a fresh full production build and a separate Ready Preview. Conditions, Index, Pulse, cache policies, the 51-row migration ledger, schema fingerprint, source freshness, and zero-active-lease state all reconciled. A synthetic non-public correction containing no personal data and its bounded monitoring event were linked and resolved as no data change.

Retained evidence:

- [machine run packet](run-01-forward-fix.v1.json)
- [recovered Preview smoke](recovered-preview-smoke.v1.json)
- [local correction changelog](correction-changelog.md)
- [protocol](../../../data/ROLLBACK-FORWARD-FIX-REHEARSAL.md)

The canonical record is `run_complete_pending_owner_signoff`. QA-019 remains unchecked: no external status record exists and Fernando has not recorded a dated approval or rejection.

Verification:

```sh
npm run validate:external-release-rehearsal
```
