# IDX-001 evidence

Completed 2026-07-11.

The current Civica Index remains available as a secondary research experiment. The quarantine covers the claim registry, reader UI, structured metadata, navigation, API documentation and responses, export rights, release artifacts, and Atlas loading.

The API methodology envelope now reports:

- `status: beta`
- `standing: secondary_research_experiment`
- `independent_validation: false`
- `atlas_dependency: false`
- numeric-position presentation with `categorical_grades: false`

The desktop navigation reads `Index · Beta`; the mobile navigation describes it as `Civica Index (beta)`. The Atlas loader creates a null research-layer record for every jurisdiction before reading optional Index rows. The frozen Atlas release excludes Index and Pulse output, and the Index bulk-release rights record remains blocked.

Verification:

- `npm run validate:index-quarantine` — passed
- Five seeded regression classes fail closed: desktop navigation, API standing, Atlas coupling, release exclusion, and claim registration
- `npm run validate:public-claims` — zero authority or country-grade leaks
- `npm run validate:api-docs` — 15 strict examples passed
- `npm run validate:claims-docs` — passed
- `npm test` — 656/656 passed
- `npm run build` — passed
- Local API `/api/v1/index/methodology` returned the complete research-standing envelope
- Browser check at `/civica-index`: research-beta title and limitation copy present, `Index · Beta` visible, no horizontal overflow at desktop or 390 × 844 mobile viewport, and no console errors
