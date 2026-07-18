# PUL-024 — Pulse drift monitoring

## Purpose

PUL-024 requires operational drift monitoring separate from validity claims.
It must make a changed source mix, language mix, model set, taxonomy-label
mix, corroboration-weight distribution, abstention rate, or human-review
overturn rate visible without treating those signals as accuracy or calibration
evidence.

## Current boundary

The configured production database has enough retained rows to exercise a
read-only monitor (on 2026-07-18: 1,202 raw events, 249 event projections,
59 stage runs, and 7,062 decision rows in the previous 30 days). It does not,
however, contain a complete scheduled `pulse-v2.15-beta` cycle: live
classification remains on the older deployed method. A baseline under the
locked prospective method must therefore not be invented or backfilled from
those mixed-version rows.

## Implementation plan

1. Define a pure, versioned drift contract with the seven required metric
   families, minimum evidence rules, fixed categorical-distance thresholds
   stored with every snapshot,
   and a no-baseline/insufficient-evidence state.
2. Add append-only baseline, observation, and alert relations. A baseline is
   explicit and immutable; scheduled monitoring never silently moves it.
3. Load bounded, rights-safe aggregate counts and row identifiers from the
   existing Pulse evidence tables. Alert records point to the affected
   relation, bucket, window, and bounded sample IDs, with a stable remediation
   runbook link.
4. Run the monitor after a successful score run. A drift alert is an
   operational warning, not a failed score write; an infrastructure failure
   does fail the cron response so it can be retried safely.
5. Add a manual baseline-capture command that refuses mixed method versions
   and a read-only live audit. The command may create a baseline only after
   the owner/platform start boundary has produced enough frozen-method
   observations.
6. Cover distribution distance, novel models/labels, insufficient evidence,
   idempotent persistence, and a deliberately shifted fixture with tests.

## Non-claims and completion boundary

The monitor detects changes in operational distributions. It does not estimate
retrieval recall, source representativeness, label accuracy, fairness, or
confidence calibration; PUL-018 through PUL-023 retain those gates.

PUL-024 can be checked only after a versioned eligible baseline exists and an
actual scheduled frozen-method observation records (or correctly reports) the
monitoring outcome. The implementation itself must not change that checklist
state.
