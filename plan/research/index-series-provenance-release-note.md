# Index series provenance — research release note

Version: `civica-index-series-provenance-2026-07-v1`

- Adds the closed `as_published_release` and `harmonized_backcast` vocabulary.
- Separates observation period, original publication cut, calculation time, method, and citation label.
- Classifies all eight stored Index method/quarter groups as harmonized backcasts after a live calculation-clock audit.
- Records that the current database contains no genuine historical as-published Civica Index release.
- Adds series provenance to deprecated Index API contracts and the Governance Evidence JSON export.
- Makes `series_type=as_published_release` return an explicit unavailable state for Governance Evidence rather than relabelling the 2026 backcast over 2024 observations.
- Supersedes the selected-product external-review bundle with `governance-evidence-review-packet-2026-07-v2`, which binds the series audit and revised code while preserving v1 unchanged.
