# Release-candidate staging and smoke protocol

**Contract:** `civica-release-candidate-staging-smoke/v1`
**Task:** QA-018
**Current status:** new exact-candidate run pending external authority

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

The 2026-07-26 Vercel CLI isolation probe found that the persistent Preview
connection resolves to the production Neon branch. Do not use that inherited
value. Build the exact committed candidate from a clean detached worktree with
the disposable branch URL already present in the process, then deploy the same
prebuilt output with a deployment-scoped `DATABASE_URL` override. The Vercel
CLI dotenv loader does not replace an existing process value, and the QA-018
static target-inventory check rejects database scripts that use
`override: true`.

The preferred runtime proof is
`vercel env pull <temporary-file> --id <deployment-id> --yes`, followed by the
exact target guard. The output filename is mandatory: omitting it can overwrite
`.env.local`, including a symlinked file. Delete the temporary file after the
bounded identity check. Vercel currently permits that pull only while a
deployment is `INITIALIZING`; a prebuilt deployment can pass through that state
before the CLI can inspect it. A successful preferred proof retains exactly one
sanitized attempt (`expectedState: INITIALIZING`, `observedState:
INITIALIZING`, `outcome: pulled`) and no provider error body.

The only accepted fallback is an exact Preview runtime attestation. It retains
a truthful nonempty set of sanitized attempts whose expected state is
`INITIALIZING`, whose observed state is only `BUILDING` or `READY`, and whose
outcome is `state_window_rejected`, together with the bounded
`deployment_state_window_unavailable` code. It does not retain the provider
error body. The fallback binds the same deployment ID, exact
`*.vercel.app` URL and host, target `preview`, candidate commit, child
project/branch/endpoint/hostname hash, forbidden production
branch/hostname hash, authoritative head, and a child-only Conditions release
ID/method/manifest observed through that deployed host. A record may use one
proof mode only; a successful environment pull cannot also claim the fallback.

The bounded runtime JSON mirrors those attempts without provider text. The
preferred mode uses status `pulled`, attempt `INITIALIZING_pulled`, and an empty
`alternativeProof`. The fallback uses status
`tooling_state_window_unavailable`, attempt values
`BUILDING_expected_INITIALIZING` and/or `READY_expected_INITIALIZING`, and
`alternativeProof: exact_preview_runtime_identity`.

Both modes must prove a newly authorized disposable Neon child, a host
different from production, and authoritative head `0051_eminent_jocasta`.
The retained 2026-07-26 child and Preview identifiers belong to the earlier
`0050` rehearsal and must not be reused as current-candidate evidence. A generic
screenshot, inherited Preview environment, project-level configuration, or
unbound database query is not a runtime attestation. Abort on any mismatch. Do
not persistently edit the Vercel project environment, invoke a browser-opening
SSO command, promote the Preview, or open a Neon dashboard.

The checked static-asset manifest means the complete Vercel Build Output API
`static` tree, not the editorial illustration manifest or Next.js route-chunk
manifest. Build once, generate and verify the deterministic inventory, then
deploy that same output without rebuilding:

```sh
DATABASE_URL=<disposable-branch-url> vercel build --target=preview --yes
node --import tsx scripts/staging-static-assets.ts \
  --root=.vercel/output/static \
  --out=plan/evidence/QA-018/staging-static-assets-attempt-07-0051.v1.json
node --import tsx scripts/staging-static-assets.ts \
  --root=.vercel/output/static \
  --verify=plan/evidence/QA-018/staging-static-assets-attempt-07-0051.v1.json
DATABASE_URL=<disposable-branch-url> vercel deploy --prebuilt \
  --target=preview --yes --env DATABASE_URL
```

The generator records every regular file's relative path, byte count, and
SHA-256 in deterministic order and refuses an empty tree, a symbolic link, a
changed file, or an unlisted extra file. Record the printed manifest SHA-256 in
the run record. The placeholders above describe the variable binding only;
operators pass the secret through a protected process environment and never
place it in shell history or evidence.

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
| `0049_curvy_shen` | ATL-027 |
| `0050_index_release_header_contract` | PLT-014 |
| `0051_eminent_jocasta` | ATL-027 |

There is no authoritative `0041` migration. The machine validator compares
this closed sequence with the authoritative manifest tail, so a newly added,
omitted, reordered, or renamed migration blocks the rehearsal before any
external action. The owner-task mapping identifies the task-specific live
validator and evidence packet that must be updated after the common migration
pass; it does not imply that any owning task is complete.

## Ordered run

Follow the ordering and abort points in `data/DEPLOYMENT-REHEARSAL.md`, with
the complete migration scope above controlling QA-018 wherever older prose
stops at `0042`. Against the isolated branch, first confirm that its starting
ledger is exactly `0032_sparkling_genesis`. The exact planning commands are
`npm run db:plan -- --all --live --out=plan/evidence/QA-018/migration-plan-attempt-07-0051.json`
and `npm run db:migrate -- --plan`; both must report the same 18-migration tail
with no `0041`. Only then run `npm run db:migrate` once. Do not deploy if either
identity differs.

Attempt 07 uses new evidence paths throughout:
`migration-plan-attempt-07-0051.json`,
`staging-static-assets-attempt-07-0051.v1.json`,
`run-07-preview-smoke.v1.json`, `browser-matrix-attempt-07-0051.json`, and
`attempt-07-isolated-preview-smoke-2026-07-26.md`. Never overwrite an
attempt-06 artifact.

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

The retained 2026-07-26 run is historical evidence for the earlier `0050`
candidate. It used the exact-Preview fallback because the
deployment-scoped environment pull was rejected at both `BUILDING` and `READY`.
`plan/evidence/QA-018/run-06-preview-smoke.v1.json` binds deployment
`dpl_DuymaVKNXCiyc34cC7q9SuRW6pMw` and commit
`fb7376f3ee7990c89b9da57716b3e563924af028` to the isolated child, migration
head `0050_index_release_header_contract`, the three current research-product
pointers, cache/error/dry-run checks, and unchanged source freshness. The
That record remains valid for its exact candidate, but it does not cover the
new forward migration or satisfy the current `0051` candidate run. The
canonical current record therefore contains no provider IDs or outcomes and
remains pending external authority.

Vercel tooling may create or inspect the isolated deployment and capture its
bounded project/deployment identifiers. It does not apply database migrations,
prove Neon branch isolation, quiesce an already-running job, or substitute for
the post-migration live validators.

## Sign-off and cleanup

Fernando records the remaining manual checks and dated sign-off. The disposable
branch is deleted only after bounded evidence is retained. A successful staging
run does not authorize production promotion.
