# PUL-043 — private coding-workspace reconciliation

## Status

Completed on 2026-07-29. The guarded production repair preserved both legacy
studies, added only isolated append-only successors, replayed with zero further
writes, and passed `npm run validate:pulse-evaluation-packets:live`.

The dated closure record is
[`production-closure-2026-07-29.md`](production-closure-2026-07-29.md). The
pre-change preparation below remains part of the audit trail.

## Pre-change read-only evidence

`npm run plan:pulse-evaluation-workspace-reconciliation` read the private
workspace without writing and recorded:

- legacy study: `pulse-evaluation-batch-a-v1`
- legacy study ID: `4cda0b69-259e-4d86-bc2a-0dc07ff65e0b`
- preserved legacy packet-set hash:
  `0e1089d2de4032f442256cd57f842d54c6f92361e30a4d13ec902f5e38e57e36`
- legacy immutable fingerprint:
  `ae8e000471fdb415941bc89b947a74e7f4df0a009317bc30616ac98da0a3731e`
- legacy setup state: 384 packets, zero participants, zero assignments
- required successor: `pulse-evaluation-batch-a-v2`, 384 packets, packet-set
  hash `100c44c3397474c3c0ef8a96879b2099aa5823e286f65806c9605e6a97285b46`

The zero-write migration plan reported four additive/non-destructive statements
against `pulse_coding_studies` and no writes. At this checkpoint, the live
validator stopped with the expected migration prerequisite: the supersession
columns did not yet exist, so it could not falsely report the unrepaired
workspace as valid.

A fresh disposable PostgreSQL 17 cluster applied all 45 authoritative
migrations and matched the checked post-migration public-schema fingerprint:
`6c724c61b9292ea5b4a8ebc2d982c708d89035b71c0f510ef521b193411bb00a`.

## Prepared execution order

1. Run `npm run db:plan -- --id=0045_pulse_evaluation_workspace_reconciliation --live` immediately before the change and review its zero-write report.
2. Apply the checked migration through the normal authoritative migration path.
3. Run `npm run plan:pulse-evaluation-workspace-reconciliation -- --apply`.
   The script inserts only a new disabled successor study, its audit rows, and
   its 384 packet rows. It never issues participants or assignments and contains
   no update/delete path.
4. Run `npm run validate:pulse-evaluation-packets:live` and record the green
   output before checking PUL-043 complete.

The successor has a restrictive `supersedes_study_id` reference and the closed
reason `frozen_packet_hash_mismatch`. It does not alter the legacy study's
identity, hash, packet snapshots, evidence, access state, or audit history.

During production validation, a second mismatch was identified for batch B.
The same fail-closed, append-only contract was extended to that isolated study;
the dated closure record documents the exact resulting writes and validation.
