# Pulse source-coverage shared-contract v3 migration

API clients require no response migration from v2. The route, schema version, state vocabulary, and fields are unchanged.

The change affects internal claim registration and generated documentation only. Clients migrating from before PUL-008 should use `feeds.observedEvidence` for retained historical source IDs and `/api/v1/pulse/source-coverage` for current operating state.
