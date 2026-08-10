# Migration plan — main working-tree integration (2026-08-09)

Zero database writes. The authoritative migration head remains
`0051_eminent_jocasta`, already applied to production on 2026-07-29. This
integration ships code and documentation only; no schema change, data
migration, backfill, or source ingestion accompanies it. Rollback is a git
revert of the integration merge on `main`.
