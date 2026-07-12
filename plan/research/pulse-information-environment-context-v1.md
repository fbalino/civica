# Pulse information-environment context: immutable evidence contract

Status: implemented under `pulse-v2.15-beta`; production weighting and
observability use remain disabled.

## Research boundary

Information conditions affect what an event monitor can observe. A country
score cannot correct that problem by itself. It may support sensitivity work
or a conservative observability disclosure after separate validation, but it
must not manufacture an event, a stable period, or a country-quality judgment.

## Evidence layers

The contract separates three records:

1. `pulse_information_environment_releases` fixes the publisher, exact URL,
   release, observation year, retrieval time, content SHA-256, coverage,
   rights status, and permitted use.
2. `pulse_information_environment_values` contains exactly one row for every
   supported non-aggregate jurisdiction in that release. Each row is either an
   observed score and derived tier or an explicit missing state with a reason.
3. `pulse_event_information_environment_pins` copies the exact value or
   missing state available when an event projection is inserted. The pin also
   fixes the event, jurisdiction, classification run, release, source,
   vintage, retrieval time, content hash, rights/use status, and classification
   time.

All three relations reject updates and deletes. A database trigger creates the
event pin, so later corroboration and scoring runs can only read it. Existing
events predate this contract. Their pins say that the historical value is
unrecoverable; the RSF 2026 value was not attached retrospectively.

## Official release and missingness

The registered source is the official RSF World Press Freedom Index 2026 CSV.
Its exact capture is identified by SHA-256
`65ec7bd9b9740e0f51e9b4eea585030b2226c1a96938ec06a4cbbdbd2639aae2`.
The private input contains 180 publisher rows. Civica's complete coverage
ledger has 176 direct ISO3 matches and 75 explicit missing rows across 251
supported non-aggregate jurisdictions. Four publisher codes do not match a
supported Civica jurisdiction; 75 Civica jurisdictions have no publisher
match. Neither condition is repaired through aliases, territorial inheritance,
or imputation in this release.

The source-input manifest retains the release metadata and adapter hash. The
publisher file remains in ignored private storage and is not part of a public
release.

## Weighting and observability

Production corroboration reads the immutable pin but applies multiplier one.
The legacy threshold/multiplier design remains available only through an
explicit sensitivity mode. It is not a calibrated probability or reporting-
bias correction.

The country-period API does not currently use the RSF pin to assign
`restricted_information_environment`. That use remains blocked until source
rights and a validation protocol for the observability interpretation both
pass. A missing or rights-blocked context therefore cannot change an event
weight or turn an empty period into a country assessment.

## Supersession

A later official dataset is a new release with new value rows. New events may
pin that release after its adoption time. Old event pins do not change. A
method change requires a new pin schema/method version and a reviewed forward
migration; it cannot rewrite the v1 evidence.
