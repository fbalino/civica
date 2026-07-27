# Pulse event absorption v1

Status: implemented research-beta contract; no current absorbed events.

## Purpose

Pulse events and later structural observations can describe related
institutional change. A country-level movement alone does not show that a
particular event has entered an Index source. The v1 contract therefore treats
absorption as a separate event-level decision rather than a change to source
corroboration.

## Eligibility

An `absorbed` decision requires all of the following:

- two closed Index releases with sequential observation periods;
- the same declared fixed-scale transformation and display identity;
- the same dimension source and indicator identity;
- an exact Pulse event, jurisdiction, dimension, and current-release link;
- confirmed link standing from a human reviewer or a source-native exact link;
- event and Index-observation evidence references plus a versioned link method
  and rationale;
- fixed-scale movement meeting the declared threshold and matching the event's
  direction.

Model output may propose a candidate link, but cannot confirm one. A failed
condition produces `not_absorbed` with explicit reasons.

## Storage and scoring

`pulse_event_absorptions` is append-only. Every row records the prior and
current release IDs and scores, scale identity, delta, threshold, link standing
and actor type, method versions, as-of date, rationale, evidence references,
and any superseded decision key. A reversal is another row.

Corroboration continues to measure the configured evidence-group heuristic and
never writes this ledger. The score loader selects the latest absorption
decision as of the score date. `absorbed` applies a zero multiplier; every
other state applies one. The stored corroboration weight remains unchanged.

## Current standing

The closed release registry contains three harmonized backcasts of the same
2024-Q4 observation period. They are not a sequential comparison. Civica
therefore has no eligible release pair, no stored absorption decisions, and no
current zero absorption multiplier. This prevents the system from presenting
same-period method changes as evidence that a Pulse event entered a structural
source.
