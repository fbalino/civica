# QA-008 evidence — statistical reproducibility

## Verified partial milestones

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

## Commands

```sh
npx tsx --test src/lib/ci/subgroup-fairness-inputs.test.ts
CIVICA_RESEARCH_INPUT_DIR=/protected/civica-research-inputs npm run validate:index-subgroup-fairness
CIVICA_RESEARCH_INPUT_DIR=/protected/civica-research-inputs npm run validate:index-longitudinal
npm run validate:statistical-reproducibility
```

## Open closure work

QA-008 remains open. The other database-backed analysis generators must adopt
the same offline protected-input replay contract, then all registered
validators need an isolated read-only execution record with tool versions and
deliberate input/method drift evidence.
