# Pulse observability shared-contract v5 release note

**Contract version:** `civica-index-api-contract-pulse-observability-v5`

The country-dimensions API now returns a strict `pulse-observability/country-period-v1` block alongside experimental dimensional deltas. Observation state and event observation are separate. Cross-field validation rejects a numeric delta when the country-period contains no qualifying event and rejects a no-event statement when observation is insufficient.

The Pulse runtime method advances to `pulse-v2.5-beta`. No historical migration narrative is added to the reader site.
