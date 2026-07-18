# QA-006 — ingestion and sync contract fixtures

## Outcome

`civica-ingestion-contract-fixtures/v1` is a checked, deterministic inventory
of every current external production source/pipeline pair. It derives 62
fixtures across 39 external pipelines and 44 released sources from the
canonical production-adapter registry, source-input manifest, and rights
manifest. It does not copy publisher payloads, production rows, credentials,
or make network requests.

Every source/pipeline fixture binds its real adapter or writer test suite and
then asserts the contract outcomes for:

- normal input and a successful retry (one retained row and freshness advance);
- empty, malformed, upstream-schema-change, and partial input (no row or
  freshness advance);
- dry run and duplicate input (zero-write/no-freshness outcomes); and
- public distribution under the source's rights record. Restricted and pending
  sources remain retainable with provenance, but their public distribution is
  blocked; this does not incorrectly treat a rights restriction as a reason to
  discard an internal source record.

All outcomes carry canonical source URL, format, upstream version/vintage,
expected coverage, redistribution posture, and the actual rights decision.
The test rejects an unrepresented source, missing pipeline witness, scenario
omission, source/version omission, stale rights disposition, or stale checked
artifact. The production-adapter validator invokes this gate, and the QA-001
matrix records it for every external pipeline.

## Files

- Checked fixture inventory: `data/ingestion-contract-fixtures.v1.json`
- Contract and source-test witness registry:
  `src/lib/qa/ingestion-contract-fixtures.ts`
- Generator/validator:
  `scripts/generate-ingestion-contract-fixtures.ts` and
  `scripts/validate-ingestion-contract-fixtures.ts`
- Task plan: `plan/QA-006-ingestion-contract-fixtures-2026-07-18.md`

## Verification

Run on 2026-07-18:

```sh
npm run generate:ingestion-contract-fixtures
npm run validate:ingestion-contract-fixtures
npm run validate:production-adapters
node --import tsx --test src/lib/data/__tests__/source-input-manifest.test.ts
npm run validate:verification-matrix
npm run typecheck
npm run validate:ci-workflow
npx eslint src/lib/qa/ingestion-contract-fixtures.ts src/lib/qa/ingestion-contract-fixtures.test.ts scripts/ingestion-contract-fixture-source.ts scripts/generate-ingestion-contract-fixtures.ts scripts/validate-ingestion-contract-fixtures.ts src/lib/qa/verification-matrix.ts src/lib/data/__tests__/source-input-manifest.test.ts
node plan/tools/validate-master-plan.mjs
git diff --check
```

All listed QA-006 checks pass. The source-input-manifest runtime validator also
exposed a pre-existing stale `ci-beta-2024-Q4` adapter-version hash after
PLT-023's serverless database boundary changed an Index adapter dependency.
That separate frozen-release reconciliation is now explicit **DAT-035**; it
must classify the change and update only legitimately derived metadata, never
publisher bytes, scores, or historical retrieval values.

The scoped files pass targeted ESLint. The repository-wide `npm test` currently
passes 1,857 of 1,866 tests; its six failures are existing rate-limit and route
inventory count expectations, an Index change-control baseline, and a data
dictionary table-count expectation, all outside QA-006. The repository-wide
lint ratchet separately flags one pre-existing optional-chain assertion in
`src/lib/platform/pipeline-observability.test.ts`, also outside this task.
