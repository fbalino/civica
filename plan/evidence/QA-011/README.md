# QA-011 — isolated operator journeys

## Acceptance evidence

`npm run test:qa-011` is the single, database-free gate for the five
operator journeys below. The runner explicitly removes `DATABASE_URL`,
`RUN_DB_TESTS`, and all paid-model credential variables before it starts the
fixtures. The selected tests use local stubs, deterministic fixtures, and
disposable PGlite state only; they do not send production writes or paid
provider requests.

| Journey | Covered controls |
| --- | --- |
| Admin session and safe mutation | Login/session expiry and revocation, same-origin mutation control, sanitized errors, audit outcomes, safe redirect, and rate limiting. |
| Blinded coding and adjudication | Coder session, independent packets, locked submissions, peer-label hiding, separate adjudicator, comparisons, and bounded export. |
| Disputes and corrections | Stale-dispute recovery, two-sided resolution, severity boundaries, and correction/retraction/clarification outcomes. |
| Scheduled-data delivery and recovery | Cron authentication/input validation, idempotency, durable leases and fences, per-route delivery, partial failure, retry, and stable Pulse run recovery. |
| Alert and incident recovery | Pipeline, error, and health alerts retain closed context and clear only after the declared healthy state. |

The journey registry is `src/lib/qa/operator-journeys.ts`; it rejects missing
required journeys, duplicate fixtures, non-test entries, and absent test files.
The corresponding negative registry checks are in
`src/lib/qa/operator-journeys.test.ts`.

## Observed verification

On 2026-07-18, `npm run test:qa-011` completed with **197 passing tests**, no
failures, skips, or TODOs, in approximately 7.2 seconds. Its command is also
recorded as coverage evidence for admin, reviewer, cron, and production-pipeline
rows in `data/verification-matrix.v1.json`.

Run after changing an admin/reviewer control, coding-workspace behavior, a
dispute/correction flow, cron delivery boundary, or operational alert contract:

```sh
npm run test:qa-011
npm run validate:verification-matrix
```

## Boundary

This proves isolated operational behavior. It intentionally does not claim a
live provider, production database, or deployed-cron rehearsal; those remain
separate release and external-operation checks.
