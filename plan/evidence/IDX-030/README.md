# IDX-030 evidence

## Outcome

`data/releases/index-change-control-v1/registry.v1.json` is the append-only control surface for future Index changes. Its current semantic snapshot is `dd14ea135ffcd0cd1f8ae15d9f437ae29d312272d4ac9118e63904f5c11909cb`.

- Sixty-three files are classified across input, transform, weight/model, missingness, uncertainty, band/rank, and presentation.
- Every non-test root module under `src/lib/ci` is classified or explicitly excluded as change-control/package administration; a new unclassified module fails.
- Protected-file drift requires an appended record whose path list and categories exactly match the hash diff.
- `fromVersion` must equal the prior `toVersion`, `toVersion` must change, and the parent snapshot must match.
- Documentation, public registry, release note, migration plan, golden test, and contract test evidence are all mandatory. A later record fails if any role merely reuses unchanged evidence.
- Category-specific validators plus the disposition and selected-product review packet are mandatory. Future transform/model records must add a new version-specific validator rather than attempting to rewrite the immutable v1 tournament.
- CI invokes `npm run validate:index-change-control:run`, which executes every declared command and stops on the first failure.

## Workflow

The owner/agent runbook is `plan/research/index-change-control-runbook.md`. A future compliant record is generated with:

```sh
npm run generate:index-change-control -- --metadata=path/to/change.json
npm run validate:index-change-control:run
```

## Verification

```sh
npm run validate:index-change-control
npm run validate:index-change-control:run
node --import tsx --test src/lib/ci/index-change-control.test.ts
npx tsc --noEmit
npm run build
node plan/tools/validate-master-plan.mjs
```

The dynamic runner successfully reran all ten declared validators. The full unit suite contains five change-control fixtures covering the clean baseline, undeclared semantic drift, stale evidence reuse, version/validation omissions, and the additional future model-validator requirement.
