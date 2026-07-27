# PUL-032 — versioned classifier state and bounded retries

PUL-032 replaces the inferred “pending raw row” queue with explicit state for
each raw cluster and classifier configuration. The configuration hash covers
the actual voter, verifier, and subject-attribution models; method, ontology,
algorithm, prompts, publication gate, decoding mode, and retry policy. Batch
membership, source IDs, upstream run IDs, secrets, and run IDs do not affect
that hash.

The closed states are `classified`, `none`, `retryable_failure`, and
`terminal_failure`. Never-attempted clusters run before due retries. Claims use
a database lease, so overlapping workers cannot spend on the same cluster.
The retry policy permits three attempts, beginning with a 15-minute delay and
capping later waits at six hours. Exhaustion and non-retryable errors become
terminal. A valid `none` judgment is terminal and distinct from failure.

Every claim and completion phase is written to the append-only
`pulse_classification_attempts` ledger in the same database statement that
changes current state. Sanitized errors cannot retain credentials. Pipeline
runs close with model-call, retry, terminal, and claim-collision counts. The
CLI and cron summary expose new, due, scheduled, terminal, and oldest-eligible
queue state.

The live migration backfilled 384 directly provable classified cluster states
and one retained invalid cluster as `terminal_failure`. Their attempt rows use
`model_call_count = 0` plus explicit `unknown_not_retained` metadata; zero is a
backfill sentinel rather than a claim that historic classification used no
models. No `none` history was invented. At verification time, 841 pending
clusters were new work under `pulse-v2.10-beta`; PUL-032 did not call models or
drain that backlog.

The forward migration and production preflight are recorded in
`migration-plan.md`. Test, live-invariant, and build results are recorded in
`verification.md`.
