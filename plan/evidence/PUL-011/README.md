# PUL-011 evidence

## Outcome

`pulse-decision-ledger/v1` separates seven decisions that the earlier event row
compressed together: event existence, subject attribution, category labels,
severity, calibration, corroboration, and publication. Each decision is an
append-only typed row with its own actor, method, evidence references, payload,
stage run, and same-axis supersession link. The current `pulse_events` row is a
projection for compatibility, not the decision history.

The verifier now records independent event-existence, category, severity, and
publication judgments and can refute any of them. Subject attribution,
corroboration, and manual publication review write their own decisions. The
schema rejects a generic `confidence` payload. Calibration explicitly remains
`not_calibrated`, while corroboration is labeled
`heuristic_not_probability`.

## Persistence and migration evidence

- Authoritative migrations `0016_loving_maggott.sql` and
  `0017_validate_decision_supersession.sql` replay on an empty database.
- The production-shaped upgrade fixture creates all seven event decisions plus
  one non-event decision, rejects updates, rejects cross-axis supersession, and
  finds no generic confidence payload.
- The live authoritative ledger is 18/18 migrations with fingerprint
  `915ed87da97d2e85c245aaf4d3ec72ca28af6d83ad9e047d1ab93ed138e17b5f`.
- The live ledger contains 2,688 decisions: seven decisions for each of 384
  retained events. Legacy projections are explicitly unresolved rather than
  being recast as newly verified judgments.

## Public contract

Runtime method `pulse-v2.7-beta` publishes the seven decision axes, the
append-only rule, same-axis supersession rule, legacy projection boundary,
verifier axes, and the distinction between calibration and heuristic
corroboration. The methodology uses the same contract and does not describe the
corroboration weight as a probability or calibrated confidence score.

The Index/Pulse semantic change is recorded as shared contract v7 with its own
release note, migration note, metadata, golden snapshot, and contract tests.

## Browser checks

See `browser-checks.md`. The methodology page was checked in light and dark
modes after the contract and prose changes.

## Boundaries

This task does not claim that the decisions are accurate or calibrated. PUL-012
owns richer jurisdiction attribution, PUL-013 owns complete negative-evidence
retention, and PUL-021 owns empirical calibration. The decision ledger creates
the audit structure those tests require.

## Verification

```sh
npx tsc --noEmit
npm test
npm run validate:pulse-decision-ledger
npm run validate:pulse-decision-ledger:live
npm run validate:authoritative-migrations
npm run validate:authoritative-migrations:live
npm run validate:pulse-runtime
npm run validate:data-dictionary
npm run validate:content-templates
npm run validate:index-change-control
npm run validate:design-tokens
npm run validate:claims-docs
node plan/tools/validate-master-plan.mjs
npm run build
```

The full suite contains 799 passing tests.
