# ATL-027 migration plan

`0042_grey_sally_floyd` adds Conditions releases, frozen reference sets, and
normalization parameters. It also adds nullable release IDs to the existing
calculation and score rows, preserving any pre-freezing legacy history while
requiring all new release-writer rows to bind a release.

## Local catalog verification — 2026-07-18

A disposable PostgreSQL 17.9 catalog applied the authoritative sequence from
`0000_authoritative_baseline` through `0042_grey_sally_floyd`. The regenerated
public-schema fingerprint and a separate check both matched:

`e1f235df3365201b394b0c0a4850727d7c8317f0816c4014ded2309666af291f`

No Neon schema, Conditions release, source data, or score row changed.

## Staging procedure

PLT-019 must use a disposable Neon child branch. It must run the zero-write
plan, apply through `0042`, then ingest every Conditions dimension with its
explicit release ID. Evidence must show the stored manifest, reference-set
population/hash, parameters, aligned/missing/refused calculations, an identical
rerun with zero writes, and refusal of a changed payload under the same release
ID before production authorization is considered.
