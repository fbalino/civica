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
   IDs and method versions it will expose, all pending migration IDs, and a
   SHA-256 over the checked static-asset manifest.
2. Obtain Fernando's authority for one disposable Neon child branch and one
   isolated Vercel staging deployment. The staging project must not receive the
   production database URL.
3. Disable staging jobs and prove no active lease remains. Do not use a
   deployment as a job-stop mechanism.

## Ordered run

Follow `data/DEPLOYMENT-REHEARSAL.md` exactly. The run record cannot become
`complete` until all twelve checks pass with bounded evidence:

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

Record IDs, hashes, timestamps, result counts, and pass/fail outcomes only. Do
not retain credentials, database URLs, production rows, cookies, prompts,
provider error bodies, or private review data.

## Sign-off and cleanup

Fernando records the remaining manual checks and dated sign-off. The disposable
branch is deleted only after bounded evidence is retained. A successful staging
run does not authorize production promotion.
