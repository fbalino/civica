# QA-001 — production verification matrix

## Outcome

`civica-verification-matrix/v1` is a checked, generated matrix for the full
production verification scope. It contains 261 critical surfaces:

- 173 Git-tracked Next.js pages, route handlers, and error boundaries;
- 50 scheduled/manual production pipelines;
- 8 published research-calculation families;
- 14 Atlas data domains; and
- 16 Atlas, pipeline, and request failure states.

Every entry carries an owner, fixture, command, plus unit, integration,
database, browser, and manual coverage cells. Incomplete cells link to a
stable open checklist task (`QA-003`, `QA-008`, `QA-011`, `QA-013`, `ATL-018`,
or `DAT-034`); no status labels missing coverage as complete.

## Artifact and enforcement

- Machine-readable artifact: `data/verification-matrix.v1.json`
- Human operating guide: `plan/research/qa-verification-matrix-v1.md`
- Source registry and completeness contract: `src/lib/qa/verification-matrix.ts`
- Production-surface discovery: `scripts/verification-matrix-source.ts`
- Generator and fail-closed validator: `scripts/generate-verification-matrix.ts`,
  `scripts/validate-verification-matrix.ts`

The validator discovers Git-tracked/indexed `src/app` pages, handlers, and
error boundaries (the release/CI source set); takes pipelines, calculations,
domains, and states from their canonical registries; verifies every expected
entry appears exactly once; and rejects blank evidence metadata, unknown gap
IDs, stale checked JSON, and a stale semantic hash. It is included in
`build:core`.

## Local verification

Run on 2026-07-18:

```sh
npm run generate:verification-matrix
npm run validate:verification-matrix
npm run validate:atlas-surface-data-matrix
npm run validate:production-adapters
npm run validate:pipeline-observability
npm run validate:golden-tests
npm run validate:ci-workflow
npm run validate:claims-docs
npm run typecheck
node plan/tools/validate-master-plan.mjs
git diff --check
```

The focused matrix suite includes a negative fixture that deletes a discovered
route from the generated object and confirms validation reports it as an
unregistered critical surface. No production database, external source, paid
model, or browser write is needed to verify this registry.
