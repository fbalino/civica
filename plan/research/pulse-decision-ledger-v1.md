# Pulse independent decision ledger

**Resolution:** `pulse-decision-ledger/v1`

**Status:** adopted for the Pulse v2.7 beta runtime

## Problem

The event table previously combined several judgments in one current-state row: whether a report described an event, which country it concerned, its category, its severity, a corroboration weight, and whether it could publish. The classifier audit JSON preserved model output, but it did not provide a stable row for each judgment. A single agreement or confidence label could therefore be mistaken for support across the whole chain.

## Decision axes

The ledger stores seven decision kinds:

1. `event_existence`
2. `subject_attribution`
3. `category_labels`
4. `severity`
5. `calibration`
6. `corroboration`
7. `publication`

Every row carries a verdict, typed payload, actor, pipeline-stage run, method version, rationale, evidence references, and decision time. The actor identifies a classifier, verifier, subject attributor, corroborator, publication gate, human reviewer, or explicit legacy projection.

The adversarial verifier produces separate verdicts for event existence, subject attribution, category, and severity. It may refute any of those axes without changing the others. Corroboration and publication have their own actors and payloads.

## Current projection

`pulse_events_v2` remains the current event projection used by reader queries and scoring. It is not a decision-history table. This keeps existing read paths stable while the decision ledger records how the projection was produced and challenged.

A non-event cluster has an event-existence decision with no event ID. This is necessary because rejected clusters never receive a `pulse_events_v2` row.

## Confidence boundary

The decision schema prohibits a generic `confidence` field. Model self-confidence, ensemble agreement, and verifier confidence remain diagnostics in their stage output. They do not stand in for event truth, attribution accuracy, category accuracy, severity accuracy, corroboration, and publication eligibility at once.

The corroboration decision retains `confidenceWeight` because the existing score formula consumes that scalar. Its payload must also state `heuristic_not_probability`. The value is a hand-set scoring weight based on evidence grouping and agreement. It is not a calibrated probability.

## Supersession

Decision rows are append-only. A correction creates a new decision and may name the row it supersedes. The new row must concern the same cluster, event, and decision kind. The database blocks updates and deletes; the live validator rejects cross-axis supersession.

Human review records only the axes it changes. Approval or rejection creates a publication decision. Rejection also records an event-existence refutation. An edited category or severity creates a new row for that axis. Unchanged axes are left alone.

## Legacy boundary

Every retained event receives seven `legacy_projection` rows during migration. Event existence is affirmed because the cluster is present in the event ledger. Other axes are unresolved when their original independent judgment cannot be reconstructed. Their payloads preserve the current stored projection without assigning a modern method, provider, or verifier retroactively.

Retained `non_governance` clusters receive an event-existence refutation tied to their recorded classification run. No modern decision is inferred for a pending or failed historical cluster.

## Verification

`npm run validate:pulse-decision-ledger` checks the typed decision builders, independent verifier axes, schema contract, stage writers, migration, append-only trigger, runtime declaration, and methodology text.

`npm run validate:pulse-decision-ledger:live` additionally requires:

- all seven decision kinds for every retained event;
- a refuted event-existence decision for every retained non-governance cluster;
- matching event and decision cluster IDs;
- no generic confidence payload;
- explicit heuristic standing on corroboration rows; and
- same-axis, same-event supersession.

The authoritative migration is replayed on an empty database and on a production-shaped fixture containing one event and one non-event cluster. The fixture must yield seven event decisions, one non-event decision, no generic confidence field, and an update rejected by the append-only trigger.
