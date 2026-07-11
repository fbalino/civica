# Pulse observability shared-contract v5 migration

Clients of `/api/v1/pulse/:country_slug/dimensions` must accept the new required top-level `observability` object. Read `observationState` and `eventObservation` independently. A `null` delta with `no_qualifying_event_observed` means the operational threshold was met but no eligible event contributed. A `null` delta with `not_assessable` means coverage, outage, or sourced information-environment limits prevent a no-event statement.

Clients must not convert either state to a zero, stability label, or country-quality value. The existing per-dimension fields and route remain unchanged.
