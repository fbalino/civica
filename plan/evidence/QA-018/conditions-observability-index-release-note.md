# Conditions observability shared-registry release note

The shared production-adapter registry now routes
`conditions.current-beta` through `scripts/ingest-conditions-all.ts` and its
single observed production command. Legacy HDI, GPI, and economic
single-dimension entrypoints are no longer represented as canonical production
pipeline implementations.

This is an operational Conditions observability correction. Index inputs,
calculations, scores, ranks, release selection, publication state, public
responses, and methodology are unchanged. The active Index release remains
`ci-beta-r5-2024-Q4` under method `beta-r5`.
