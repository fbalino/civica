# Release-candidate staging and smoke protocol

**Contract:** `civica-release-candidate-staging-smoke/v1`  
**Task:** QA-018  
**Current status:** pending external authority

This protocol specializes `data/DEPLOYMENT-REHEARSAL.md` into the evidence
required to close QA-018. The canonical run record is
`data/release-candidate-staging-smoke.v1.json`. A prepared protocol is not a
passing staging run.

## Before any provider action

1. Select one exact Git commit. Record the Atlas/Index/Conditions/Pulse release
   IDs and method versions it will expose, the complete migration plan below,
   and a SHA-256 over the checked static-asset manifest.
2. Obtain Fernando's authority for one disposable Neon child branch and one
   isolated Vercel staging deployment. The staging project must not receive the
   production database URL.
3. Disable staging jobs and prove no active lease remains. Do not use a
   deployment as a job-stop mechanism.

## Closed migration scope

The prepared staging migration plan requires the future isolated branch to
start from the configured database ledger at `0032_sparkling_genesis`.
`db:migrate` is an ordered ledger operation, so the QA-018 run must plan and
apply every authoritative migration after that head. It cannot select only the
migration associated with the task currently being reviewed.

| Migration | Owning task |
| --- | --- |
| `0033_flat_hardball` | PLT-009 |
| `0034_superb_the_fallen` | PLT-010 |
| `0035_equal_marvex` | PLT-010 |
| `0036_moaning_toad_men` | PLT-014 |
| `0037_minor_sharon_carter` | PLT-016 |
| `0038_heavy_slyde` | PLT-017 |
| `0039_living_clea` | PLT-018 |
| `0040_closed_young_avengers` | ATL-026 |
| `0042_grey_sally_floyd` | ATL-027 |
| `0043_pulse_decay_lifecycle` | PUL-027 |
| `0044_pulse_drift_monitoring` | PUL-024 |
| `0045_pulse_evaluation_workspace_reconciliation` | PUL-043 |
| `0046_little_mulholland_black` | ATL-020 |
| `0047_atlas_data_error_reports` | ATL-024 |
| `0048_entity_name_forms` | EXP-029 |

There is no authoritative `0041` migration. The machine validator compares
this closed sequence with the authoritative manifest tail, so a newly added,
omitted, reordered, or renamed migration blocks the rehearsal before any
external action. The owner-task mapping identifies the task-specific live
validator and evidence packet that must be updated after the common migration
pass; it does not imply that any owning task is complete.

## Ordered run

Follow the ordering and abort points in `data/DEPLOYMENT-REHEARSAL.md`, with
the complete migration scope above controlling QA-018 wherever older prose
stops at `0042`. Run `npm run db:plan -- --live` against the isolated branch,
confirm that its starting ledger is exactly `0032_sparkling_genesis` and its
pending set is the closed sequence above, then run `npm run db:migrate` once.
Do not deploy if either identity differs.

After the shared apply, run the authoritative-ledger and schema-fingerprint
checks plus every owning task's documented live validator. Retain each
task-specific result under its own evidence packet rather than treating one
green schema check as proof that all product behavior passed.

The QA-018 run record cannot become `complete` until all twelve checks pass
with bounded evidence:

1. zero-write migration plan;
2. authoritative migration application;
3. final schema fingerprint;
4. exact release-data and method identities;
5. deployed commit identity;
6. mutable/checked/frozen cache headers;
7. representative Atlas browser read;
8. selected Index API release;
9. selected complete Pulse publication;
10. protected error path;
11. one idempotent non-model cron dry run; and
12. proof that the dry run did not advance source freshness.

After all twelve technical checks pass, the record first becomes
`run_complete_pending_owner_signoff`. That state requires the exact candidate
and provider identities plus bounded evidence for every check, but it keeps the
owner and sign-off date empty and names Fernando's remaining review. Only his
later dated decision can move the record to `complete`.

Record IDs, hashes, timestamps, result counts, and pass/fail outcomes only. Do
not retain credentials, database URLs, production rows, cookies, prompts,
provider error bodies, or private review data.

Vercel tooling may create or inspect the isolated deployment and capture its
bounded project/deployment identifiers. It does not apply database migrations,
prove Neon branch isolation, quiesce an already-running job, or substitute for
the post-migration live validators.

## Sign-off and cleanup

Fernando records the remaining manual checks and dated sign-off. The disposable
branch is deleted only after bounded evidence is retained. A successful staging
run does not authorize production promotion.
