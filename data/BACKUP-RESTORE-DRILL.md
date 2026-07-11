# Backup, point-in-time recovery, and release restoration

**Contract:** `backup-restore-drill/v1`

This drill restores a read-only snapshot of the live Neon database into a
temporary PostgreSQL cluster on the operator's machine. Production is never a restore target.
WAL point-in-time recovery is exercised only inside that local
cluster. The checked result is `plan/evidence/DAT-021/restore-drill.json`.

## Safety boundary

- Use PostgreSQL 17 clients because Neon currently runs PostgreSQL 17.
- Convert the pooled Neon hostname to its direct hostname for `pg_dump`.
- Set `PGOPTIONS=-c default_transaction_read_only=on` for every production
  connection. Only `pg_dump`, read-only checksum queries, and version queries
  may use `DATABASE_URL`.
- Refuse any restore command whose target is not a newly initialized directory
  under `/tmp` and a loopback socket/port.
- Never commit the custom-format dump, base backup, WAL archive, restored data
  directory, connection string, or provider credentials.

## Logical backup and isolated restore

1. Create a custom-format snapshot with `pg_dump --format=custom --no-owner
   --no-privileges`. Record its byte size, SHA-256, completion time, PostgreSQL
   versions, and the direct-endpoint/read-only posture.
2. Initialize a disposable PostgreSQL 17 cluster under `/tmp`, create a new
   empty database, and restore with `pg_restore --no-owner --no-privileges`.
3. Compare the production snapshot and restored database using table counts, a
   complete public-schema fingerprint, and order-independent row hashes for
   `jurisdictions`, `sources`, `country_facts`, and `statements`.
4. Record the time from an available dump to a queryable, verified database.

## Local point-in-time recovery

1. Start the restored cluster with `wal_level=replica`, `archive_mode=on`, and
   an archive command that writes only beneath the temporary drill directory.
2. Create a probe table with a `before-target` marker and take a physical base
   backup with `pg_basebackup -Fp -Xs`.
3. Create a named PostgreSQL restore point, replace the probe marker with
   `after-target`, switch WAL, and stop the temporary primary.
4. Copy the base backup to a second temporary directory, add `recovery.signal`,
   and start it with the temporary WAL archive, named recovery target, and
   `recovery_target_action=promote`.
5. Pass only if `before-target` exists, `after-target` does not, the server log
   names the intended restore point, and the original schema/data hashes still
   match.

This proves PostgreSQL WAL replay and the Civica recovery checks without
changing Neon. A provider-managed Neon branch/PITR exercise remains in the
manual queue because the repository has no Neon management credential or
declared retention-window contract.

## Frozen release archive

Copy the checked Atlas gzip and BOM into a separate temporary directory. Pass
only if compressed and uncompressed sizes, archive SHA-256, semantic SHA-256,
and row counts match the BOM exactly. The release archive is independent of the
database restore and must remain usable if the database is unavailable.

## Assets outside the drill

The database and checked release do not contain provider secrets, deployment
settings, restricted publisher payloads, or third-party media bytes. Restore
publisher inputs through their recorded access/hash instructions. Country and
portrait images that are referenced from Wikimedia Commons require a separate
availability check or future compliant media archive.
