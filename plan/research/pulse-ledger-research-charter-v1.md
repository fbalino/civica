# Civica Pulse ledger research charter v1

**Resolution:** `pulse-ledger-charter/v1`

**Adopted:** 2026-07-11

**Status:** Active research charter

**Canonical citation:** [Pulse methodology — Research charter](https://civicaatlas.org/civica-index/methodology/pulse#research-charter)

## Resolution

Civica will develop Pulse first as a versioned ledger of documented governance-relevant events. Its unit is one evidence-linked record of an identifiable occurrence affecting a jurisdiction&rsquo;s domestic governing institutions at a stated date. An article, model vote, source count, country-day, and numeric delta are not ledger units.

The intended users are researchers, journalists, civic educators, reviewers, and data users who retain event-level evidence and uncertainty. Pulse is not approved for automated eligibility, sanctions, lending, migration, employment, or security decisions; country grades, rankings, and risk scores; or as a substitute for specialist datasets.

## Admission boundary

An event enters the research ledger only when it concerns an in-scope domestic institutional occurrence, has a bounded event date, retains at least one source identity, carries explicit subject evidence, and can be separated from commentary, prediction, source failure, and duplication. Lawful or normatively ambiguous events may be recorded descriptively. Inclusion does not declare them beneficial or harmful.

Opinion, rhetoric, forecasts, polling movement, general conditions without an institutional occurrence, foreign-policy acts without a separate domestic event, unsupported rumors, and duplicate or republished accounts are not separate ledger events. No qualifying event observed and low observation are different states.

## Sources and scope

Eligible evidence classes are specialist monitors, attributable official institutional documents, and established news reporting subject to source-family and republication controls. The current operating basket is always the generated runtime contract at `/api/v1/pulse/methodology`; connector code alone does not make a feed active.

The geographic scope is Civica jurisdictions with recorded subject-attribution evidence. Comparative evaluation centers sovereign states. Ambiguous and cross-border cases stay unpublished until they can be represented explicitly. At charter adoption, the retained provisional history began on 2026-04-13, but that is only the earliest stored event in the adoption snapshot, not the beginning of complete observation. Actual language and temporal coverage are release properties, not universal claims.

## Non-claims and observability

The ledger is not complete, exhaustive, real-time, or continuously observed. A missing record does not establish stability, absence, or good governance. A published event is not a country score, rank, causal estimate, fully human-reviewed fact, independent corroboration claim, or calibrated probability.

Media restrictions, connectivity, feed outages, query design, paywalls, language support, publisher cadence, and source concentration all affect observability. Pulse must store and expose low observation separately from no qualifying event observed.

## Success, suspension, and retirement

Success requires complete event evidence/version history; representative, preregistered evaluation of retrieval, clustering, attribution, labels, severity, abstention, and publication; subgroup and source-bias gates; qualified-reader evidence tracing; and retained prospective and adverse results. No criterion compensates for another unless a future protocol explicitly preregisters that rule.

Publication is suspended when rights, evidence identity, attribution, correction history, or observability distinctions cannot be maintained. The ledger is retired or redesigned if preregistered retrieval, event-identity, attribution, or subgroup-safety gates fail without a bounded repair that passes a new evaluation. Numeric effects are retired independently if they invite country-quality interpretation or fail the later Pulse disposition. No-value is a valid result.

Changing the construct, unit, admission boundary, source classes, scope, success gates, or retirement rules requires a new charter version and migration note. New evidence does not rewrite this resolution.
