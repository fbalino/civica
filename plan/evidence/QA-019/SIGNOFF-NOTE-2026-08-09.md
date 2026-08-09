# QA-019 dated sign-off note — 2026-08-09

## Authority

Fernando authorized the QA-019 staging rollback/forward-fix rehearsal in
writing in the 2026-08-09 working session. The written record is
[`plan/evidence/QA-018/OWNER-SIGNOFF-2026-08-09.md`](../QA-018/OWNER-SIGNOFF-2026-08-09.md),
which names the QA-019 rehearsal as one of the distinct authorized operator
runs. Staging only; no production authority is granted or claimed by this
note.

## The run this note closes against

The rehearsal run is the retained isolated technical run of 2026-07-27
(`run-01-forward-fix.v1.json`):

- Deliberately bad candidate `e7b0f774ee513841a6104ff1615ba57380cabae6`
  reached Ready as protected Preview `dpl_EFszKTseA9kfXjsFLPmuwm74z9hj`,
  backed only by the disposable QA-018 Neon child branch. The seeded
  release-marker mismatch (`qa019-isolated-preview-release-marker`) was
  detected by the declared smoke check.
- Containment held: no production alias, zero active cron leases before and
  after, production database read-only at `0032_sparkling_genesis`.
- Recovery was a reviewed one-line forward fix,
  `9db1f5c82699de42487fdfbc7646eeb914cbd418`, with a fresh full build and a
  distinct Ready Preview (`dpl_49zyGJp5KPQ4qnzrG2cYxw5Qyyxu`).
- Cache policies, static-asset manifests, migration ledger head
  `0051_eminent_jocasta`, schema fingerprint, Conditions/Index/Pulse release
  identities, and source freshness all reconciled exactly.
- The real local correction path was exercised: synthetic non-public
  correction `7e914c77-1727-4f85-bd41-38a2e43f43e8` (no personal data) and
  linked monitoring event `9c1a6d6c-654a-4f0f-a7ed-9f9644c997ce`, both
  resolved with no Atlas data change (`correction-changelog.md`).
- All twelve closed check IDs in
  `data/rollback-forward-fix-rehearsal.v1.json` pass with evidence.

On 2026-08-09, `npm run validate:external-release-rehearsal` (contract unit
suite plus evidence validator) and `node plan/tools/validate-master-plan.mjs`
re-passed against this retained evidence. No new deployment, database write,
external action, or paid model call was made in this closure session.

## Checklist closure

QA-019's checklist definition — a deliberately bad staged release detected,
contained, rolled back or forward-fixed, with caches/artifacts/version
metadata consistent and correction/status/changelog flows matching policy —
is satisfied by the retained run, so the checkbox is checked in
`plan/MASTER-CHECKLIST.md` and `plan/09-testing-qa-and-release.md` under the
2026-08-09 execution authority.

## What still needs the owner

The canonical record deliberately remains
`run_complete_pending_owner_signoff` with blocker
`owner_status_record_and_post_run_signoff`. Two owner actions are open, and
nothing in this note or the checklist closure substitutes for them:

1. **External status record.** Review and create the external status-page
   record for the rehearsal without notifying subscribers. No such record
   exists; `statusRecordId` is null and must stay null until the owner
   creates a real one.
2. **Dated disposition of the retained run.** Fernando reviews the retained
   recovery evidence and records a dated approval or rejection. Only both
   actions together allow the record to become `complete`.

Additionally, per protocol step 8, any job resumption tied to staging
recovery remains a separate production action outside this rehearsal; none is
claimed here.
