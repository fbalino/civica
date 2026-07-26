# QA-018 attempt 05 — target isolation and Pulse rehearsal

The disposable Neon branch from attempt 04 remained isolated at authoritative
head `0048_entity_name_forms`. Production remained at
`0032_sparkling_genesis`; a read-only Vercel CLI target probe recorded a
different production branch, endpoint, and hostname before production evidence
was read.

## Environment-precedence correction

The first task-specific live checks were discarded after inspection showed
that several scripts loaded `.env.local` with `override: true`. That pattern
could silently replace an explicitly injected staging URL. Those discarded
commands were read-only; no database mutation occurred.

Every QA-018 database-target script now preserves an existing process
environment and the external-release validator statically scans the complete
inventory. A seeded negative fixture proves that reintroducing
`override: true` fails the rehearsal contract. The inventory includes
migration, schema, retention, Atlas, Index, Pulse, Conditions, and observed
pipeline commands.

## Pulse staging result

A deterministic dry run planned 380 corroboration updates, 13 events, 65
jurisdictions, 325 dimension rows, and three significant deltas. It made no
model or paid API call. The first publications exposed a second defect:
application/database clock skew could make the application-authored completion
timestamp fractionally earlier than Neon’s database-authored start timestamp.
The terminal evidence was retained and not rewritten.

The publisher now uses the database clock for run completion and score pointer
publication. The next append-only successor run has ordered timestamps, the
publication pointer selects it, the source-freshness aggregate is unchanged,
and the canonical live lifecycle validator passes with 325 current rows across
65 jurisdictions and 2,600 immutable outputs across eight score runs.

The bounded record is
[`../PUL-027/qa-018-staging-rehearsal-2026-07-26.json`](../PUL-027/qa-018-staging-rehearsal-2026-07-26.json).
This is staging evidence only and does not close PUL-027.

## Production read-only evidence

Vercel CLI environment injection resolved the verified production branch
without printing or persisting its sensitive values. The Pulse runtime
historical evidence cut was refreshed from 2026-07-22 to 2026-07-26, the
observed source-ID set remained unchanged, and the freshly regenerated PUL-040
readiness record still reports only two of five current-method automatic
stages complete. No prospective clock started.

No production database write, production deployment, model call, paid call,
external review, owner sign-off, or PUL-043 reconciliation repair is claimed.
The PUL-043 append-only repair remains separately approval-gated.
