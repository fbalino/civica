# Pulse source-coverage shared-contract migration

Clients reading `/api/v1/pulse/methodology` must replace `feeds.activeProduction` with `feeds.observedEvidence`. The renamed block describes source IDs retained historically; it must not be used as a current uptime or operating-feed signal.

Clients that need current feed state should read `/api/v1/pulse/source-coverage`. Only rows with `state="operating"` satisfy the operating contract. `degraded` and `inactive` are explicit non-operating outcomes. Strict API clients must add the new endpoint schema and accept connector `blindSpots` in the runtime snapshot.

No stored event migration is required. New ingest runs carry connector telemetry in their existing immutable `counts` and `failures` fields; older runs remain without inferred component metrics.
