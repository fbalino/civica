# DAT-016 — Research evidence retention

## Outcome

DAT-016 is complete. `research-evidence-retention/v1` preserves prior state for
updates and deletions across a closed registry of 29 evidence-bearing database
relations.

Migration `0024_research_evidence_retention` added:

- an append-only `research_evidence_history` table;
- synchronous triggers that capture complete before/after rows, operation,
  reason, actor, and database time;
- restrictive foreign keys for Pulse source and review-audit evidence;
- terminal Pulse raw-event dispositions and retained classifier decisions;
- internal `pulse_evaluation_evidence` and
  `reconciliation_evaluation_evidence` views.

The classifier reads only pending raw events. Non-governance and invalid
decisions remain available for later false-negative adjudication. Rejected
Pulse events appear as false-positive candidates. Rejected, demoted, and
superseded country facts remain joined to the dispute ledger for reconciliation
error studies.

## Live evidence

The migration applied transactionally in 17 statements. The live validator
reported:

- 29/29 retention triggers active;
- one append-only guard active;
- both Pulse evidence foreign keys restrictive;
- zero malformed raw-event dispositions;
- zero malformed history rows;
- 14 Pulse evaluation rows, including one retained false-positive candidate;
- 36 reconciliation evaluation rows;
- 38/38 checked migration preflight plans after the migration.

No history rows existed immediately after migration because the triggers apply
from migration `0024` forward. Evidence deleted before that point cannot be
reconstructed; the policy records this survivorship boundary explicitly.

## Acceptance evidence

- `src/lib/research/evidence-retention.test.ts`: seven adversarial fixtures
  cover trigger closure, append-only enforcement, actor/reason/time fields,
  cascade prevention, retained classifier negatives, both evaluation views,
  and the deletion exemption registry.
- `npm test`: 614/614 passed.
- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- Targeted ESLint: zero errors or warnings.
- `npm run validate:research-evidence-retention:live`: passed.
- Migration, preflight, data-dictionary, operational-documentation, Pulse
  runtime, production-adapter, source-manifest, and claims gates passed.
- No reader UI changed, so browser rendering checks were not required.

The operational policy is in
`data/RESEARCH-EVIDENCE-RETENTION.md`. DAT-017 is the next checklist task.
