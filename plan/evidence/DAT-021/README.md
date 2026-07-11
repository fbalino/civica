# DAT-021 — Backup and restoration drill

## Outcome

DAT-021 is complete. A production-read-only PostgreSQL 17 snapshot was restored
into a disposable local cluster, then recovered through archived WAL to a named
point before a destructive local probe. The frozen Atlas release was restored
separately and checked against its bill of materials.

No production write occurred. The dump, base backup, WAL archive, restored
clusters, sockets, and temporary release copy were deleted after verification.

## Verified recovery

- 50 public tables, 253 jurisdictions, 25,827 country-fact rows, 56 sources,
  and 7,891 statements matched the source snapshot exactly.
- Public-schema and order-independent `jurisdictions`, `sources`,
  `country_facts`, and `statements` hashes matched before and after PITR.
- Recovery stopped at `dat021_before_destructive_probe`: `before-target` was
  present and `after-target` was absent.
- Logical restore plus count verification took 3,319 ms from an available dump;
  physical base backup took 1,164 ms and PITR startup took 193 ms.
- Atlas archive compressed/semantic hashes, byte sizes, and 253/12,373/3 row
  counts matched `civica-release-bom/v1`.
- Four external gaps are listed in `restore-drill.json`; the provider-managed
  Neon branch exercise and external-media disposition are in `MANUAL-CHECKS.md`.

## Evidence and gate

- Machine-readable result: `plan/evidence/DAT-021/restore-drill.json`
- Procedure and safety boundary: `data/BACKUP-RESTORE-DRILL.md`
- Build gate: `npm run validate:backup-restore`
