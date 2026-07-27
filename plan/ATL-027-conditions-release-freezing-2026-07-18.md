# ATL-027 — Conditions release freezing

## Objective

Freeze every published Conditions calculation to an explicit release identity.
For each dimension/reference period, the release must retain the exact eligible
population, included components, missingness policy, transformation direction,
and normalization parameters. Re-running an existing release must be an exact
no-op; changed inputs require a successor release.

## Design

1. Add immutable Conditions release, reference-set, and normalization-parameter
   relations. A reference set stores its sorted jurisdiction population and
   hash, period, components, and missingness policy. Parameter rows retain
   direction, transform, and either mean/standard deviation or fixed bounds.
2. Bind new calculation and score rows to a release. Release-scoped identity
   prevents a later rerun from overwriting an older value with identical
   coordinates.
3. Require an explicit `--release-id` in every Conditions ingestion. A release
   manifest hashes the canonical release configuration, reference sets,
   parameters, and calculation identities. Existing release IDs accept only an
   identical manifest and perform zero writes.
4. Calculate economic z-score parameters independently per reference year;
   a country is never normalized against a mixed-year population. HDI and GPI
   record their fixed-bound transforms under the same release contract.
5. Add fixture/migration/static validation, dictionary and retention coverage,
   then record a zero-write live preflight. No migration or source ingestion
   runs against Neon without the owner-approved staging procedure.

## Completion boundary

The implementation can be verified locally. ATL-027 remains unchecked until
the isolated staging release is created, re-run determinism is observed against
the staged database, and its controlled production promotion is authorized.
