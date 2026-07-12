# Research evidence retention

**Contract:** `research-evidence-retention/v1`
**Effective from:** migration `0024_research_evidence_retention`

## Scope

Civica keeps the evidence needed to reproduce and challenge its factual and
experimental outputs. The protected registry currently covers 34 relations:
country facts and disputes, Index inputs and outputs, Pulse inputs and review
records, elections, constitutions, legislatures, organizations, officeholders,
provenance statements, corrections, and backtest records.

Every update or deletion on a protected relation writes the complete prior row
to `research_evidence_history` before the mutation proceeds. Updates also store
the resulting row. Each history entry records the relation, row identifier,
operation, reason, actor, and database timestamp. The history table rejects
updates and deletions.

Rate-limit counters are the only registered deletion exemption. They are
short-lived abuse-control state and contain no source, classification, review,
or evaluation evidence.

## Pulse

Raw Pulse inputs now carry one of four dispositions: `pending`, `event`,
`non_governance`, or `invalid`. Terminal decisions retain the classifier output,
reason, and decision time. The classifier queue reads only pending rows.

Classifier execution also has a configuration-keyed state projection and an
append-only attempt ledger. State updates retain their before/after rows; an
attempt records its claim and completed outcome as separate immutable entries.
Retryable failures keep a sanitized error and next-eligible time. Successful,
none, and exhausted outcomes are terminal for that configuration.

Human-review operations add a retained obligation projection and an append-only
SLA event ledger. Queue entry, escalation, bounded exceptions, disposition, and
the pre-contract legacy-quarantine boundary remain available for audit. A
legacy-quarantined item is unpublished and is not a human review decision.

Pulse dimensional scores have a mutable current-state projection and a separate
append-only `pulse-dimensional-delta-history/v1` ledger. Every computation
records its score run, jurisdiction, dimension, contributing event IDs,
derivation envelope, score date, and trailing 365-day lookback. Zero-output
clearing rows remain in that ledger so an aged-out signal can be reproduced
without treating its deleted or zeroed current projection as historical truth.

`pulse_evaluation_evidence` provides one internal query surface for:

- classifier negatives that may become false-negative cases after adjudication;
- invalid classifications that need parser or taxonomy analysis;
- human-reviewed events, including rejected false-positive candidates.

Pulse source links and reviewer audit rows use restrictive foreign keys. A
Pulse event cannot silently erase its supporting or review evidence through a
cascade delete.

## Reconciliation

Country facts already retain non-active candidates through status values such
as rejected, demoted, and superseded. `reconciliation_evaluation_evidence`
combines those candidates with the complete dispute ledger. The generic history
trigger preserves later changes to both sets of records.

## Rights and access

These ledgers are internal research records. Retention does not grant
redistribution rights. Embedded source material keeps its publisher terms and
must pass the rights manifest before any public release or bulk export.

## Historical boundary

The contract applies from migration `0024` forward. It cannot reconstruct rows
deleted before that migration. In particular, previously discarded Pulse
non-event classifications are not recoverable from the current database. Any
evaluation of earlier periods must disclose that survivorship limit.

## Verification

- `npm run validate:research-evidence-retention` checks repository closure.
- `npm run validate:research-evidence-retention:live` checks the database
  triggers, append-only guard, restrictive foreign keys, views, and row shapes.
- `src/lib/research/evidence-retention.test.ts` contains the adversarial
  retention fixtures.
