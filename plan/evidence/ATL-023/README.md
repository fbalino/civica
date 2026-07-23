# ATL-023 evidence — reproducible Atlas case studies

Date: 2026-07-23

Release: `atlas-2026-07-11`

Artifact schema: `civica-atlas-case-studies/v1`

Semantic SHA-256: `e26d60b94a3f5c9b5d26e5ff6699ffc5f6a4a9f0cb3083402350e5124d1e2369`

Status: complete

## Published studies

The checked artifact
`data/releases/atlas-2026-07-11/case-studies.v1.json` contains three complete,
frozen studies:

1. **Which records belong in a sovereign-state denominator?** Replays all 253
   jurisdiction rows and keeps the sourced status classes separate: 194
   sovereign states, two associated states, 47 dependencies, eight
   disputed/limited-recognition records, and two aggregate/special records.
2. **Which population observation does the frozen France record publish?**
   Replays the canonical France population selection with value, display
   string, reference year, source, method, vintage, hashes, and dispute state.
3. **How can institutional context remain separate instead of becoming a
   composite?** Replays 20 source-native facts for France, Ghana, Japan, Samoa,
   and Uruguay across government form, monarchy status, World Bank region, and
   World Bank income group without producing a score or causal claim.

Each case includes a research question, the complete frozen input rows used,
the exact API recipes and page counts, a decision trail, generated table
output, source rights, limitations, and a stable citation.

## Reproduction and publication

- `scripts/generate-atlas-case-studies.ts` regenerates the artifact from the
  checked Atlas release by passing every recipe through the real request
  parser and query engine.
- `scripts/validate-atlas-case-studies.ts` regenerates in memory and requires
  byte-for-byte equality with the checked artifact.
- `src/lib/atlas/case-studies.test.ts` validates completeness, exact recipe
  replay, deterministic tables, rights, exclusions, stable citations, and
  seeded drift failures.
- `/methodology/case-studies` renders the checked artifact through canonical
  editorial components. The page is linked from Methodology, its sidebar, the
  footer, the sitemap, and the matching API documentation.

## Verification

- `npm run generate:atlas-case-studies` — pass.
- `npm run reproduce:atlas-case-studies` — pass; output is byte-identical.
- `npm run validate:atlas-case-studies` — pass; 11 tests.
- `npm run validate:api-docs` — pass.
- `npm run validate:cache-consistency` — pass after declaring the artifact
  reader page request-live.
- `npm run validate:verification-matrix` — pass; the page, route, pipeline, and
  failure-state matrix contains 266 registered surfaces.
- `npm run validate:numeric-claims` — pass; visible case-study counts are bound
  to release `atlas-2026-07-11`.
- `npm run validate:design-tokens` and `npm run typecheck` — pass.

The final claims/documentation aggregate passed every component except the
unit-suite wrapper, where the two remaining failures are unrelated user-owned
Index/design changes recorded in the ATL-021 evidence. All ATL-023 tests pass.

Real-browser verification covered:

- the complete three-study reader page;
- the API documentation and its linked exact recipes;
- desktop and mobile layouts;
- table containment without document-level horizontal overflow;
- successful rendering with no case-study-specific console or request failure.

## Boundaries

- These are reproducible descriptive demonstrations of a frozen release, not
  external validation, peer review, or causal research.
- The France display string and normalized numeric field are both retained
  because the frozen release contains both; the study does not silently
  reconcile that internal publisher-format difference.
- No human review, DOI registration, deployment, or production write is
  claimed by this evidence.
