# Pulse source-coverage shared-contract v4 migration

API clients require no response migration from v3. The route, schema version, state vocabulary, and fields are unchanged.

This version corrects test coverage only. Clients migrating from before PUL-008 should use `feeds.observedEvidence` for retained historical source IDs and `/api/v1/pulse/source-coverage` for current operating state.
