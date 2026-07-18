# ATL-031 evidence — peer-lens contracts

## Delivered contract

- Material metrics resolve only against the selected metric's observed,
  sovereign jurisdiction universe and use the World Bank region-and-income
  lens.
- Governance scores resolve only against their released observed-score universe
  and use the V-Dem regime lens.
- Results expose eligible, attempted, and final counts; fallback state; metric
  vintage; classification upstream vintage; and source retrieval time.
- The Factbook material-outcomes graph and the country-scoped metric API expose
  the material peer contract. The legacy Index panel no longer renders a
  material comparison for a governance score.

## Verification

- Peer resolver and request-contract tests: 40 passing.
- TypeScript: `npm run typecheck` passed.
- Design tokens: `npm run validate:design-tokens` passed with no new drift.
- Content templates: `npm run validate:content-templates` passed.
- Scoped ESLint: no errors; two pre-existing warnings in `queries.ts` and the
  legacy unused classification interface.
- `npm run validate:index-change-control:run` passed all six required Index
  validators.
- `npm run validate:data-value-states` and `npm run validate:golden-tests`
  passed (72 golden tests).
- `git diff --check` passed.
- `npm run validate:claims-docs` passed every documentation/public-surface
  subgate. Its embedded full suite remains blocked by five pre-existing stale
  exact-count assertions: it expects 100 route handlers and 90 tables while
  this checkout has 105 and 93 respectively. ATL-031 did not add routes or
  tables.

## Browser verification limit

The running local Next server owned port 3000 but did not respond on either
IPv4 or IPv6 within ten seconds. A second server could not start because Next
holds the workspace development lock. No process was stopped or lock removed,
so this record does not claim a rendered browser check. The typed endpoint and
rendered component paths are covered by the checks above; browser confirmation
remains an environment follow-up.

The append-only Index input-contract record binds the protected `queries.ts`
snapshot and its required validators.
