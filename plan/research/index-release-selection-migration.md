# Index release-selection migration

## Scope

The preserved Index tables already separate rows by methodology and quarter, but several reads treated those two fields as sufficient. Dimension breakdowns could still accept an unintended source, indicator, artifact, or transform under the same coordinates. The deprecated country endpoint also omitted the methodology predicate on its dimension query.

## Adopted boundary

`src/lib/ci/release-selection.ts` is the closed selection registry. Each release binds:

- release id, methodology version, quarter, and vintage label;
- five permitted source-indicator identities and the V-Dem-first fallback order;
- exact publisher artifact hashes;
- ingestion-transform, composite-algorithm, and display-transform versions.

Calculations and research reads select through this registry. A row at the requested methodology/quarter with an unregistered identity or version is an error. Rows belonging to a different registered release remain queryable only by that release id.

The stored Freedom House (`fh_pr_cl_sum`) and Transparency International (`CPI_SCORE`) indicator ids are release-pinned ingestion aliases. The governance-evidence dashboard uses the publishers' canonical research identities (`pr_cl_total` and `score`). They describe the same upstream measures in different contracts and must not be substituted across those contracts without a new versioned change record.

## API migration

The six composite endpoint families are already deprecated and have no known users. Before their announced sunset, score-bearing reads now accept `release=ci-beta-r5-2024-Q4` by default, with Beta-R3 and Beta-R4 available as exact archived releases. The former free-form `methodology` selector is removed from score-bearing routes. An optional `quarter` is an assertion against the selected release, not a second selection axis. The history route returns the exact requested frozen release row rather than constructing a cross-release series.

## Data and rollback

No table rewrite is required. Existing Beta-R3, Beta-R4, Beta-R5, and legacy rows remain unchanged. The migration changes read selection and calculation input validation only. Rollback means reverting the selector consumers; it must not delete or rewrite stored releases. The IDX-030 gate prevents rollback from silently restoring methodology-only selection under the current version.
