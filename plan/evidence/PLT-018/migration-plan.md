# PLT-018 migration plan

`0039_living_clea` adds the empty, additive `error_monitoring_events` and
`error_monitoring_issue_links` relations. Together they introduce 19 columns,
seven constraints, and seven catalog indexes (including the primary-key
indexes). The event table has one deterministic fingerprint uniqueness key;
the link table permits only opaque `correction` or `status` record identities.
No historic error, stack, digest, or incident record is manufactured.

The checked target schema fingerprint is
`1f8adaf16a7eea4cb7d91b55a42b21ee7e22fdcd7e020559d93489b6db781b30`.
PGlite applied the additive SQL and produced the exact new-relation catalog
slice used to extend the checked fingerprint. The configured Neon database was
not migrated: the 2026-07-16 zero-write 58-plan preflight reports both new
relations as `missing` and `writesPerformed: 0`.

PLT-019 owns staging/production migration ordering, deployment verification,
and a post-apply authoritative ledger/fingerprint check. Recovery before use is
an isolated pre-change backup or a reviewed forward compensation; never invent
monitoring history or reverse production DDL implicitly.
