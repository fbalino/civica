# Pulse drift monitoring

## Contract and scope

`pulse-drift-monitor/v1` compares a fixed trailing 28-day aggregate snapshot
with an explicit, immutable baseline captured for the same Pulse runtime
method. The snapshot carries the exact `pulse-drift-thresholds/v1` values used
for comparison, so a later threshold change cannot reinterpret a prior alert.
It monitors operational distributions; it does not establish retrieval recall,
event validity, label accuracy, fairness, or calibration.

The monitor records only category counts, bounded internal IDs, comparison
shares, and this remediation path. It does not copy source payloads, prompts,
model responses, or reviewer notes.

## Baseline capture

Do not create a baseline while methods are mixed. After PUL-040's start
prerequisites have passed and the locked method has enough retained source,
language, and model observations, run the read-only candidate check:

```sh
npm run capture:pulse-drift-baseline
```

Only the owner/platform release procedure may then approve the explicit write:

```sh
npm run capture:pulse-drift-baseline -- --write
```

The command refuses sparse core distributions. It never reuses older-method
rows to fill a new-method baseline, and scheduled jobs never create or move a
baseline.

## Alert handling

An alert is stored in `pulse_drift_alerts` and links to its immutable
observation, baseline, metric bucket, bounded identifiers, and this runbook.
Treat it as a research/operations investigation: preserve the alert, inspect
the linked evidence in the private review tools, record the cause, and create
a versioned remediation task. Do not alter a baseline, discard observations,
or tune a threshold after seeing an alert. A semantic method/source/prompt
change ends PUL-040's prospective window and requires a new protocol/window.

## source-mix

Inspect `pulse_drift_alerts` references to `raw_events`, current connector
telemetry, and source rights/input contracts. Check for a source outage,
connector configuration change, duplicate/republication behavior, or a real
publisher mix change. PUL-022 owns retrieval recall and outage estimation;
this alert alone is not an outage verdict.

## language-mix

Inspect the linked raw evidence language declarations and connector scope.
Confirm whether a provider changed language coverage or whether a data-source
issue occurred. Do not infer country quality or classifier fairness from this
signal; PUL-020 owns subgroup analysis.

## model-versions

A novel model/provider/version is always an alert. Stop and record the method
change before treating the outputs as comparable; update the versioned method,
repeat the affected validation gates, and restart any prospective period under
a new protocol version. Never normalize two model versions into one baseline.

## taxonomy-labels

Inspect a bounded sample of linked event rows and the ontology/prompt/version
envelope. Decide whether the shift reflects real events, a source-mix shift,
or a labeling/prompt change. PUL-018/PUL-023, not this monitor, determine
held-out label or attribution accuracy.

## corroboration-weight

Inspect linked events, source-independence evidence, and corroboration runs.
This is the distribution of an explicitly heuristic corroboration weight, not
a probability. PUL-021 owns calibration and baseline comparison.

## abstention

Inspect event-existence decision rows, classifier state, provider availability,
and retained failure/outcome evidence. High abstention can be a deliberate
safe behavior or a service problem; it must remain in later PUL-019 coverage
and quality reporting rather than being suppressed.

## review-overturns

Inspect the linked `pulse_review_audit_log` rows. An edit or reject is an
overturn for this operational metric; it is retained even when the final
published event remains valid. This signal cannot substitute for independent
coder disagreement/adjudication or end-to-end accuracy evidence.
