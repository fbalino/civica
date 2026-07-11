# Index release selection — research release note

Version: `civica-index-research-selection-2026-07-v1`

- Adds closed contracts for the preserved Beta-R3, Beta-R4, and Beta-R5 releases.
- Binds each release to one methodology, quarter, vintage, five source-indicator identities, publisher artifact hashes, ingestion transform, composite algorithm, and display transform.
- Makes V-Dem-first democratic-quality fallback selection deterministic.
- Routes calculations, score research queries, peer distributions, display transforms, and deprecated score APIs through exact release selection.
- Replaces free-form methodology/latest-quarter API selection with registered release ids; an optional quarter can only confirm the release coordinate.
- Keeps all stored historical rows unchanged. Mixed or unknown rows fail selection rather than being relabelled or deleted.
