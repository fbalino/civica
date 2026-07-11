# Pulse source-coverage shared-contract v2 migration

API clients require no response migration from v1. The route, schema version, state vocabulary, and field set are unchanged. Reader-only layout changed from a horizontally scrollable table to per-feed records.

Clients migrating from the pre-PUL-008 runtime snapshot must still follow the v1 migration: use `feeds.observedEvidence` for historical retained source IDs and `/api/v1/pulse/source-coverage` for current operating state.
