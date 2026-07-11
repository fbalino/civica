# Shared API contract migration — Pulse cluster coverage

## Compatibility

`GET /api/v1/pulse/cluster-coverage` is additive. Existing v1 response schemas and routes are unchanged. No client migration is required unless a client chooses to consume the new report.

## Consumer steps

Consumers should validate `schemaVersion`, retain `releaseId` and `reportHash`, and keep rows with different `methodVersions` separate. `standing: descriptive_not_validation` must remain attached to any downstream display. Source IDs and source families are diversity descriptors, not independent corroboration counts.

## Rollback

If the new route fails its strict schema or API documentation checks, remove its registry, schema, example, documentation section, route, and public link together. The frozen JSON artifact can remain as research evidence. Rollback does not alter the Index or any stored Pulse row.

## Validation

The contract is gated by `validate:api-docs`, `validate:claims-docs`, `validate:pulse-cluster-coverage`, and the append-only Index change-control runner.
