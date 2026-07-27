# QA-006 — ingestion/sync fixture contract

## Objective

Make the existing source-shaped and repeatability tests executable as one
closed contract for every external production pipeline and every registered
released source, without copying publisher payloads into the repository.

## Approach

1. Derive synthetic fixture declarations from the canonical production-adapter,
   source-input, and rights registries.
2. Bind each external pipeline to its existing real adapter/writer fixture
   suite. The registered suite must exist and be a Node test source.
3. Exercise a common fixture outcome model for normal, empty, malformed,
   upstream-schema-change, partial, retry, dry-run, duplicate, and
   rights-blocked/public-distribution cases. The model preserves source,
   version, provenance, row-count, and freshness policy semantics.
4. Generate a checked, rights-safe inventory, then validate source/pipeline
   coverage, scenario completeness, registered test witnesses, and artifact
   freshness.
5. Bind the new validator into the production-adapter validation path and the
   QA verification matrix for external pipelines.

## Boundaries

- Fixtures contain only source identifiers and contract metadata already
  published in the source-input/rights registries; no publisher response,
  production data, credential, or network request is used.
- The generic contract does not claim that a rights restriction blocks internal
  ingestion. It proves the separate policy: restricted/pending sources may be
  retained with provenance, but their public distribution is denied unless the
  source-rights manifest permits it.
- Existing source-specific tests remain the proof that parsers and writers
  handle their real source-shaped input. The contract fails if a source or
  external pipeline lacks that witness.
