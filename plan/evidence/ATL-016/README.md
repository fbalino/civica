# ATL-016 — Separate Conditions comparison evidence

Status: complete in the isolated QA-018 staging run.

The Conditions comparison reads the same single immutable release model as the
explorer and country panel. It exposes native component, unit, source,
reference year, value/missingness, and alignment state; it creates no
cross-country rank, cross-dimension aggregate, or economic-stability score.
Mixed reference years remain visible and all three public surfaces say that no
composite is published.

The current release-backed run used `conditions-20260727-v1`,
`conditions-components/v1`, and manifest
`267cf0f2680bc94153a85386e08ce222c6797b2c26a6a9116de4d24573301743`.
[`release-browser-reconciliation.v1.json`](release-browser-reconciliation.v1.json)
binds that release to the isolated Preview and to
[`browser-evidence-attempt-07-0051.v1.json`](browser-evidence-attempt-07-0051.v1.json).
Nine screenshots and 11 browser checks
cover the explorer, country panel, and three-country comparison at desktop and
390px mobile widths. Afghanistan proves aligned inputs, Bosnia and Herzegovina
proves mixed-year refusal, and Andorra proves missing components. Every surface
retains native source, unit, year, and missingness; none publishes a Conditions
composite or rank.

Verification:

- `npm run validate:conditions-components` — 51/51 focused tests and both
  source validators passed;
- `npm run validate:design-tokens` — zero token drift;
- API and route-I/O contracts passed for the selected-release surface.

The Preview run produced zero browser console errors and no horizontal
overflow. The API/DB reconciliation is retained under
`plan/evidence/ATL-029/`. This closes ATL-016's staging-verifiable acceptance
criteria; it does not claim a production migration or publication, and it does
not close ATL-026 or ATL-027.
