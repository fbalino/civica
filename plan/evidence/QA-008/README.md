# QA-008 evidence — statistical reproducibility

## Verified replay contract

- `npm run validate:statistical-reproducibility` pins nine checked result
  files, result identities, registered inputs, analysis entrypoints, derived
  table/figure bytes, replay commands, and declared seeds.
- Longitudinal replay reads publisher captures only from the ignored protected
  `CIVICA_RESEARCH_INPUT_DIR` cache. Network capture is an explicit verified
  operation and never a validation fallback.
- The original subgroup-fairness v1 replay exposed a real drift in small-state
  strata because it read mutable jurisdiction metadata. The v1 artifact is
  retained unchanged as historical evidence.
- `index-subgroup-fairness-v2` binds its result to protected input
  `d92c244f4e7d3f4468e2667ed0347da1fddf132be0a4817238dbfe77263bb1e6`.
  Its ordinary validator does not initialize a database client or use the
  network; missing or modified retained bytes fail closed.
- `ci-index-analysis-replay-inputs-2026-07-18-v1` binds the protected panel,
  uncertainty, longitudinal-label, and jurisdiction-metadata input used by
  dimensionality, validity, incremental-information, longitudinal,
  out-of-sample, and sensitivity analysis. Each validator reproduces its
  frozen result with `DATABASE_URL` removed.
- `npm run validate:statistical-replay` runs the static registry plus all nine
  registered analysis validators in that database-free mode. The isolated
  runtime/package-lock record is `replay-environment.v1.json`.

## Commands

```sh
CIVICA_RESEARCH_INPUT_DIR=/protected/civica-research-inputs npm run validate:statistical-replay
```

## Deliberate-drift controls

`src/lib/ci/longitudinal-input-cache.test.ts`,
`src/lib/ci/index-analysis-inputs.test.ts`, and
`src/lib/ci/subgroup-fairness-inputs.test.ts` each corrupt a retained cache
entry and prove replay fails. `src/lib/qa/statistical-reproducibility.test.ts`
proves altered input, result, seed, method, or replay registration cannot reuse
the prior artifact.
