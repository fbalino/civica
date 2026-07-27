# ATL-016 — Separate Conditions comparison evidence

Status: complete in the isolated QA-018 staging run.

The Conditions comparison reads the same single immutable release model as the
explorer and country panel. It exposes native component, unit, source,
reference year, value/missingness, and alignment state; it creates no
cross-country rank, cross-dimension aggregate, or economic-stability score.
Mixed reference years remain visible and all three public surfaces say that no
composite is published.

The release-backed run used `conditions-qa018-20260726-v2`,
`conditions-components/v1`, and manifest
`d2248097a98111753ef69916a83d4e19f86861d7cd0b739fbd6bb35cabbcb53b`.
[`release-browser-reconciliation.v1.json`](release-browser-reconciliation.v1.json)
binds that release to the isolated Preview and to
[`browser-evidence.v1.json`](browser-evidence.v1.json). Fourteen screenshots
cover the explorer, country panel, and three-country comparison at desktop and
390px mobile widths. Afghanistan proves aligned inputs, Bosnia and Herzegovina
proves mixed-year refusal, and Andorra proves missing components. Every surface
retains native source, unit, year, and missingness; none publishes a Conditions
composite or rank.

Verification:

- `npm run validate:conditions-components` — 46/46 focused tests and both
  source validators passed;
- `npm run validate:design-tokens` — zero token drift;
- API and route-I/O contracts passed for the selected-release surface.

The Preview run produced zero browser console errors and no horizontal
overflow. The API/DB reconciliation is retained under
`plan/evidence/ATL-029/`. This closes ATL-016's staging-verifiable acceptance
criteria; it does not claim a production migration or publication, and it does
not close ATL-026 or ATL-027.
