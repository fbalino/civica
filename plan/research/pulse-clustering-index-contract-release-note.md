# Shared API contract release note — Pulse cluster coverage

**Contract version:** `civica-index-api-contract-pulse-clustering-v1`
**Date:** 2026-07-11

The stable public API adds `GET /api/v1/pulse/cluster-coverage`. Its strict response contains the frozen `pulse-cluster-coverage/v1` report under `data`. The report publishes descriptive cluster-size and diversity distributions, immutable method-version identities, limitations, and its content hash.

This is an additive Pulse endpoint. It does not change an Index input, transformation, weight, missingness rule, uncertainty rule, rank, disposition, or stored score. The Index-facing contract changes only because the shared v1 registry, schema, examples, and API Docs now include the Pulse endpoint.

The endpoint's standing is `descriptive_not_validation`. Its method-version split prevents legacy clusters from being presented as current-method output. Source-family counts do not establish editorial independence.
