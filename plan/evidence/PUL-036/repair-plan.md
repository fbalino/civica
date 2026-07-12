# PUL-036 production repair plan

Verified on 2026-07-12.

The zero-write preflight registered `data-repair-pulse-agreement` as an
operational data change affecting `pulse_events_v2` and
`research_evidence_history`. Before execution, both relations existed and the
plan counted 384 event rows and 67,934 retained history rows.

The repair derived agreement from each row's retained classify votes. Rows
without a provider-distinct, prompt-versioned panel received agreement
`none`. Published rows lacking both stored support and a human review were
unpublished, moved to `legacy_quarantined`, and detached from an unsupported
publication run. Human-reviewed publication was preserved.

Application required the explicit environment flag
`PULSE_APPLY_AGREEMENT_REPAIR=yes` and ran as one Neon transaction with the
DAT-016 reason and actor context. It examined 384 events, changed 355 rows,
cleared 355 agreement labels, quarantined 191 unsupported automatic
publications, and preserved 13 human-reviewed publications. A second dry run
reported zero changes.

The post-change migration preflight covers 46 authoritative and operational
artifacts. It records 384 event rows, 68,614 retained history rows, and zero
writes during verification. Recovery remains an isolated pre-change backup or
a reviewed forward compensation; retained research evidence is never silently
rewritten backward.
