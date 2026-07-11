# Pulse candidate outcome ledger v1

**Contract:** `pulse-candidate-outcome/v1`

**Scope:** internal evaluation evidence

**Status:** active

## Purpose

Pulse keeps a separate, append-only record whenever a candidate leaves the pipeline as a duplicate, non-event, insufficient-evidence case, invalid item, refuted judgment, or human rejection. This record does not replace the raw item, event, or decision ledger. It provides one consistent evaluation surface across them.

Every outcome records the candidate identity, reason code and explanation, actor, method version, pipeline run, decision link where one exists, evidence references, and occurrence time. Duplicate attempts also point to the retained canonical candidate.

## Sampling

`pulse_exclusion_evaluation_candidates` assigns each retained outcome to a false-positive or false-negative candidate stratum. Researchers can filter by outcome and order by `stable_sample_key` to draw a repeatable sample without reconstructing exclusion logic from production tables.

The labels name review candidates, not established errors. A rejected event is useful for studying false positives; a non-event or deduplicated item is useful for studying possible false negatives.

## Historical limit

The migration backfills decisions and terminal raw items that were already retained. Earlier ingestion runs stored duplicate totals but not each duplicate attempt, so individual historical duplicates cannot be recovered honestly. The ledger records every duplicate attempt from this contract onward.

## Mutation rule

Rows are append-only. A later judgment creates another outcome or decision; it does not revise the earlier evidence.
