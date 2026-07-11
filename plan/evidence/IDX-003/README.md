# IDX-003 evidence

Completed 2026-07-11.

`ci-missingness/beta-r3` is the single current missing-data contract. It requires Democratic Quality and Rule of Law and a minimum of three of the four governance dimensions. All four dimensions publish a full estimate. Exactly one missing optional dimension publishes a partial estimate. Any missing mandatory dimension or both missing optional dimensions withhold the composite.

For a partial estimate, the available weights are renormalized to one and the simulation-input ranges use the declared 1.2 multiplier. The API publishes the policy ID, mandatory and optional dimensions, threshold, reweighting rule, multiplier, comparability warning, and withholding behavior. Strict response schemas accept only full or valid three-dimension partial rows. The leaderboard exposes the missing dimension on the partial coverage marker, and country score copy names it and warns against equal-coverage comparison.

The archived six-dimension calculator is sealed to methodology `v1.0`; it rejects every current methodology before a database read or write. Existing current rows required no migration: the live audit found 175 full four-dimension rows and 15 three-dimension partial rows, all missing only Corruption Control. No insufficient row is published.

Verification:

- `npm run validate:ci-missingness` — code, methodology, API, UI, and legacy separation agree
- `npm run validate:ci-missingness:live` — 190/190 current composites conform
- five policy fixtures cover version binding, full, partial, mandatory-missing, two-dimension withholding, legacy rejection, and fail-closed stored labels
- executable methodology fixtures include the two-mandatory-dimensions-only case
- `npm run validate:content-templates` and `npm run validate:api-docs` — passed
- `npm run reproduce:ci-current` — all 745 dimensions and 190 composites still match exactly
- `npm test` — 665/665 passed; `npm run validate:claims-docs` and `npm run build` passed
- Browser checks confirmed the three-of-four rule on the rendered methodology page and Nauru's visible “missing Corruption control” comparison warning, with no overflow or console warnings/errors at 1280 px
- The local Nauru API returned a three-dimension partial row plus the complete `ci-missingness/beta-r3` machine contract
