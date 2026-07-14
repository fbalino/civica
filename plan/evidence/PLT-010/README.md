# PLT-010 — authenticated, durable, success-honest cron delivery

**Status:** Complete
**Completed:** 2026-07-14
**Task commit:** the commit containing this evidence,
`feat(platform): harden cron delivery safety (PLT-010)`

## Outcome

Every deployed `/api/cron/*` route crosses the shared `withCronJob()` boundary
before database or handler work. The registry closes all 39 routes: 36 active
schedules and three authenticated retirement stubs.

The completed contract satisfies the task's done-when conditions:

1. Missing, wrong, or unset bearer secrets fail before delivery-store access.
   Unsupported methods and malformed or missing manual idempotency keys also
   fail before business work.
2. Scheduled work is identified by the exact registered UTC slot. Manual and
   parameterized work uses a bounded, hashed `Idempotency-Key` plus canonical
   method/query/mode/scope identity; duplicate query-value order remains
   significant.
3. One database-time lease serializes each job across instances. Monotonic
   fences close expired-worker races, three attempts bound one delivery, and a
   different delivery blocked by the lease returns unqueued `503 job_busy`
   without creating an execution or attempt. The same running delivery remains
   an explicit `202`, and input drift on its key returns `409`.
4. Handler responses are normalized so a non-2xx body cannot claim success and
   a 2xx body with `ok: false` is recorded as failure. Finalization outages
   return `delivery_finalization_failed`; they never expose an unrecorded
   success.
5. Bills, Factbook, Index, and Pulse writers advance freshness only after the
   complete required aggregate succeeds. Atomic transaction/CTE variants bind
   freshness to actual inserted domain rows, so dry, failed, empty,
   duplicate-only, and partial work cannot fake freshness.
6. Bills and every required Factbook target fail closed on unavailable,
   malformed, nonempty-but-unusable, or partial upstream output. Their
   publication/reconciliation writers roll back late failures and converge on
   retry.
7. Pulse ingest, cluster, classify, corroborate, and score retain one stable
   stage identity across retry. Classification freezes exact input values,
   publishes atomically, recovers a lost finalization, and immutably binds a
   cron delivery to its classify run. Late evidence attaches to the current
   event without reclassification or false historical timestamps.
8. Real route-module integration fixtures execute authenticated GET and POST
   deliveries for every active scheduled route, including partial failure,
   retry, and completed-duplicate suppression. Static fixtures separately
   close the full active/retired wrapper and registry inventory.

## Schema and migration evidence

- `0034_superb_the_fallen` creates the execution, attempt, and lease state
  machine with append-only/terminal guards and versioned acquire/finalize
  functions.
- `0035_equal_marvex` creates the immutable Pulse classification
  delivery-to-run binding.
- DAT-013 records **54/54** current zero-write live plans; all four new
  relations were absent before deployment.
- A disposable PostgreSQL 17 replay of migrations `0000` through `0035`
  produced **86 tables**, three views, and checked catalog fingerprint
  `f38227eb1e6e6a3d86951d8a7aa61ce875d6469efd52a4afead9dbbf8896f29c`.
- The Drizzle field dictionary covers **86 tables and 1,213 columns**.

The detailed read-only plan and compensation boundary are in
`migration-plan.md`. No production migration was applied.

## Verification

Focused and aggregate verification completed with:

- `npm run validate:cron-safety`: **256/256 tests passed** after registry,
  wrapper, PostgreSQL state-machine, route-module, adapter, atomicity,
  freshness, and retry checks;
- `npm run validate:pulse-classification-state`: **26/26 tests passed** plus
  the checked classification-state validator;
- `npm run validate:index-pulse-cron-recovery`: **14/14 tests passed**;
- `npm run validate:pulse-runtime`: **868 contract checks passed**;
- `npm run validate:pulse-version-lineage`,
  `npm run validate:sync-freshness`,
  `npm run validate:production-adapters`, and
  `npm run validate:ci-atomic-ingestion`: passed;
- `npm run validate:authoritative-migrations`: the 50-table baseline and all
  **36 ordered authoritative migrations** passed;
- `npm run validate:migrations` and
  `npm run validate:migration-preflight`: **54 forward artifacts and 54/54
  zero-write plans** passed;
- `npm run validate:data-dictionary`: **86 tables / 1,213 columns** passed;
- `npm run typecheck` and focused lint/diff checks: passed;
- isolated clean-checkout `npm run validate:route-inventory`, `npm test`,
  `npm run validate:claims-docs`, and `npm run build:ci`: passed without the
  intentional local typography tester; and
- `node plan/tools/validate-master-plan.mjs`: exact
  **305 total / 198 complete / 107 remaining / 64.9%** ledger passed.

PLT-010 changes no reader UI, so browser screenshots and theme checks are not
applicable. The intentional Uruguay/Ghana/Japan photo trials and typography
tester were neither modified nor included in the task commit.

## Limits and manual follow-up

The contract is deliberately durable **at-least-once** recovery, not a claim
of exactly-once execution across external calls and later bookkeeping. Vercel
does not automatically retry missed or failed schedules. A `job_busy` delivery
is explicitly not recorded or queued; a missed scheduled collision therefore
requires operator review. Alerting and missed-run notification remain PLT-017.

No provider/model call, live cron invocation, or production migration is
claimed. `plan/MANUAL-CHECKS.md` queues the post-deploy dry-run duplicate,
ledger/freshness, hashed-identity, and ordinary classify-binding checks.
