# Pulse country-period observability v1

**Status:** adopted operational disclosure contract

**Contract:** `pulse-observability/country-period-v1`

**Runtime method:** `pulse-v2.5-beta`

## Decision

Pulse country-period output has two independent axes. `observationState` records `sufficient_observation`, `low_coverage`, `source_outage`, or `restricted_information_environment`. `eventObservation` records `qualifying_event_observed`, `no_qualifying_event_observed`, or `not_assessable`.

The current operational threshold for sufficient observation is evidence from at least two operating feed families and at least five retained documents attributed to the jurisdiction during the scoring window. This threshold controls whether Civica may state that no qualifying event was observed. It is not a retrieval-recall estimate and does not claim representative coverage.

`no_qualifying_event_observed` is permitted only with sufficient observation. Otherwise, an empty period is `not_assessable`. An observed qualifying event remains event evidence even when broader coverage is low. No absent-event state has a numeric effect, and country-quality inference is prohibited.

## Information-environment rule

`restricted_information_environment` requires a sourced context record with a source identifier, URL, upstream version, observation year, and retrieval time. The current approximate static press-freedom lookup and its default value are ineligible. PUL-010 owns the versioned replacement.

## Scope and limitations

The period uses retrieval time and matches the current trailing scoring window. Operating and degraded feed states come from the latest shared source-coverage report. This does not reconstruct every outage inside the period, establish source representativeness, or estimate missed events. PUL-022 owns retrieval-recall and outage evaluation. PUL-035 owns removal of stale internal zero-delta rows; the public API already returns `null` and rejects a numeric delta when no qualifying event contributes.
