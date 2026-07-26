# QA-018 attempt 04 — isolated migration and schema-fingerprint replay

This authorized attempt used a disposable Neon child branch cloned from the
recorded production branch at authoritative head `0032_sparkling_genesis`. The
target guard proved a different branch, endpoint, and hostname; the child had
no attached jobs or active lease. Production was not written or deployed.

The zero-write plan named the exact 15-migration tail from `0033` through
`0048`, with no `0041`. Every migration committed successfully. The first
post-apply check then exposed a repository defect: the checked catalog
fingerprint still described an earlier migration head. The run stopped before
release publication or deployment while the mismatch was diagnosed.

The migration SQL, ledger hashes, and resulting catalog were valid. The
fingerprint artifact had not been regenerated for the later Atlas correction
history, data-error intake, and entity-name-form migrations, and it retained
the old Conditions direction constraint. No applied migration, ledger row,
snapshot, ID, or hash was rewritten.

The fingerprint was regenerated directly from the fully migrated PostgreSQL 17
child. A bounded catalog comparison found only the intended tail additions:
two relations, 45 columns, 20 constraints, nine indexes, one evidence-retention
trigger, and the Conditions constraint update that admits `not_ranked`. Nothing
was removed. Static validation now binds the artifact to the complete manifest
hash and head, verifies its serialized schema hash, and rejects legacy or stale
artifacts.

Two independent database paths converged on the corrected hash
`e7ccdd8c30a57fcf3377844aa3fca98a3c4ef8bd0ba2be30c196e8fc54b3bec8`:

- the production-shaped `0032` → `0048` child has 48 exact ledger rows, 103
  public tables, zero pending migrations on rerun, and an adopted baseline;
- a fresh empty PostgreSQL 17 database applied all 48 manifest entries, reached
  the same 103-table catalog and hash, and has an executed baseline.

The bounded machine record is
[`schema-fingerprint-replay.v1.json`](schema-fingerprint-replay.v1.json).
QA-018 remains open: migration-owner live validators and the isolated Vercel
Preview smoke sequence still have to run, followed by Fernando Baliño's dated
sign-off. The disposable branch remains scheduled to expire on
2026-07-27 at 14:59:31 UTC.
