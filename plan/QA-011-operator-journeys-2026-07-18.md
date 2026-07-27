# QA-011 — isolated operator-journey gate

## Decision

Close QA-011 with one explicit, credential-stripped command rather than a
loosely documented collection of unit tests. The registry names every fixture
file and preserves the five required operational journeys.

## Acceptance mapping

- Login/session, safe mutation, and audit logs: admin-session-and-safe-mutation.
- Reviewer queues, double coding, and adjudication: blinded-coding-and-adjudication.
- Disputes and corrections: disputes-and-corrections.
- Cron authentication/idempotency and scheduled failure recovery:
  scheduled-data-delivery-and-recovery.
- Alerts and recovery: alert-and-incident-recovery.

The runner deletes database and paid-model environment variables. Its
PGlite/mock fixtures retain the durable-state and failure-recovery behavior
without a production write or provider call.

## Ongoing verification

Run `npm run test:qa-011` after any change in scope, then run
`npm run validate:verification-matrix` so the machine-readable ledger cannot
drift from the gate.
