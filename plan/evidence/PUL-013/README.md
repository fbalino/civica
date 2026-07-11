# PUL-013 evidence

## Outcome

`pulse-candidate-outcome/v1` is the append-only negative-evidence ledger for Pulse. It retains duplicate, non-event, insufficient-evidence, invalid, refuted, and rejected outcomes. Each row records the candidate identity, reason code and explanation, actor, method version, stage run, occurrence time, evidence references, and decision link where one exists. Duplicate attempts also name the retained canonical candidate.

Ingestion now writes one outcome for every skipped duplicate instead of keeping only a counter. A database trigger derives applicable outcomes from future event-existence, verifier, and human-review decisions in the same transaction.

## Evaluation sampling

`pulse_exclusion_evaluation_candidates` exposes explicit false-positive and false-negative candidate strata with a deterministic `stable_sample_key`. Evaluation code can filter and sample this view directly without reconstructing classification or review rules from production tables.

These strata identify cases for review. They do not claim that an error has already been established.

## Migration and historical boundary

Authoritative migrations `0019_careless_avengers.sql` and `0020_attach_candidate_retention_trigger.sql` add the ledger, materialization trigger, direct sampling view, append-only guard, and general research-evidence retention trigger. The live authoritative ledger is 21/21 with schema fingerprint `43eead7c0839bb187fed41fec65f673437c57c5ebb84056300b88c8302ec41bb`.

The backfill found one retained historical human rejection. It did not invent individual historical duplicate attempts from aggregate counters. Future duplicates are retained individually from this contract onward.

## Fixtures

Unit fixtures prove stable outcome identity, distinct repeated attempts, required metadata, and duplicate persistence through the real upsert path. The live database fixture inserted a verifier refutation, observed one materialized false-positive candidate, proved that mutation is rejected, and deliberately rolled back. Zero fixture rows remained.

## Verification

```sh
npx tsc --noEmit
npm test
npm run validate:pulse-candidate-outcomes
npm run validate:pulse-candidate-outcomes:live
npm run validate:research-evidence-retention:live
npm run validate:authoritative-migrations:live
npm run validate:data-dictionary
npm run validate:index-change-control
npm run validate:claims-docs
npm run build
```

PUL-014 owns the representative sampling protocol. This task supplies the retained population and direct query surface that protocol will sample.

The complete suite finishes with 804 passing tests, and the production build renders 98 static pages. The existing non-fatal Next.js file-tracing warning remains.
