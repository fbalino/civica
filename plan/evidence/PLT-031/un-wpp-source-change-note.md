# UN WPP source repair — October 3, 2026

The quarterly UN import failed because the former UNdata exporter returns the new UN System Data Commons HTML instead of ZIP data. The documented WPP 2024 Medium bulk gzip CSV replaces that retired transport. This is the same publisher, revision, observation year, units, seven Atlas fields, and existing M49 admission boundary.

The reader fetches the bounded archive once, validates the required schema and values before writes, and retains its URL, publisher column, compressed size, and input SHA-256 in source snapshots. History, disputes, freshness, cron authentication, leases, and idempotency retain their existing paths. Malformed, empty, partial, and failed work cannot advance source freshness.

The existing UN life-expectancy configuration promises both sexes, but all 196 retained source values match the publisher's male column. The repaired mapping uses the documented both-sex `LEx` column. Exact publisher population values differ from 17 retained source strings by one person; the database's separate single-precision numeric cache is unchanged as a schema contract. Both changes are normal sourced observations recorded through the history writer; no source data is invented. Kosovo's existing M49 coverage gap remains.

The shared source-input manifest is protected by Index change control even though this change affects only the Atlas `un_data` source specification. This append-only record authenticates that specification and its regression tests. It changes no Index input, method, model, score, frozen package, release approval, or academic-review standing.

Validation and rollout: focused source regressions, independent semantic comparison, a fresh read-only production backup, isolated restore and repeated real-writer rehearsal, all configured checks, normal PR merge, then deployed dry run and stable-key application with current read-only verification. Detailed production/recovery evidence is retained outside Git under `output/data-reliability/un-data-2026-10-03/`; the pre-merge evidence record distinguishes local results from later production verification.

Rollback: revert the adapter PR to stop using the replacement transport; the old endpoint will still fail closed. Do not automatically undo sourced observations. The private pre-change snapshot and retained row history support a separately authorized bounded recovery if needed. No schema, dependency, spending, classifier, or notification change is part of this repair.

Official source checked October 3, 2026: [WPP CSV download center](https://population.un.org/wpp/downloads?folder=Standard%20Projections&group=CSV%20format).
