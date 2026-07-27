# PUL-033 — severity-based human-review service levels

`pulse-review-sla/v1` is an internal operating contract. It does not validate
the classifier, establish the truth of a severity label, or promise a staffed
response. Catastrophic-negative items are critical and due within 24 hours.
Severe-negative and high-positive items are urgent and due within 72 hours.
Other review-gated items are standard and due within seven days.

Every new pending current event receives one database-created obligation with
a recorded queue time, priority, escalation time, deadline, and SLA version.
The active queue orders priority, deadline, queue time, and stable ID. The
admin surface shows depth, age, escalation, breach, exception, and legacy
counts. A six-hour monitor writes one idempotent escalation event per threshold
and emits a structured server log. It does not claim email or staffed paging.

Exceptions require an authenticated reviewer, a closed reason, explanatory
note, prospective expiry, and a maximum duration of 30 days. They are
append-only. An exception explains a delay but never restores
daily-completeness wording. A database outage produces a non-assessable result
and withholds the claim.

The 175 current pending events found before adoption mapped one-to-one to 175
incidents. They predated an SLA and had no recorded human disposition.
Migration 0025 therefore retains them unpublished as `legacy_quarantined` and
writes one explicit operational boundary record per item. It does not relabel
them approved, rejected, reviewed, or SLA-compliant. The adjacent 474
incident-resolution candidates remain a separate PUL-031 merge-review queue;
PUL-033 does not turn similarity candidates into event-review obligations.

The forward and recovery procedure is in `migration-plan.md`. Test, live, and
browser results belong in `verification.md` after the implementation gates
finish.
