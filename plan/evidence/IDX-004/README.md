# IDX-004 evidence — honest Index uncertainty posture

## Outcome

Beta-R4 keeps the Civica Index as a secondary research experiment but removes the unsupported generic uncertainty display. The published point estimate is now the deterministic rounded weighted composite. `scoreLower` and `scoreUpper` are null, and public wording does not describe a confidence interval or imply precision that the inputs cannot support.

## Source and dependence audit

- V-Dem publishes posterior uncertainty information, but the current release adapter does not retain it.
- WGI publishes model-based standard errors, but the current release adapter does not retain them.
- Freedom House does not publish a per-country probability distribution for its consensus-reviewed score.
- The current CPI adapter retains a point score but no usable distribution.
- Usable retained uncertainty coverage is 0 of 745 released dimension rows.
- No covariance model has been estimated for overlapping concepts, expert communities, and underlying evidence.

The machine-readable audit is `data/releases/ci-beta-r4-2024-Q4/uncertainty-audit.v1.json`; `npm run validate:ci-uncertainty` checks it against code and prose.

## Reproduction and live checks

- `npm run reproduce:ci-current` recreated 745 dimensions and 190 composites with zero errors or unexplained rows.
- Dimension hash: `65ffdc77324b12f60467837549b849fde9f01a9df9ae1105acbe0a0aaf63d991`.
- Composite hash: `24b282f57a4c04bd152abbce2967f5474847f6f4c1e3cc03ca926d9783d0a605`.
- `npm run validate:ci-uncertainty:live` found 190 Beta-R4 rows, zero lower bounds, zero upper bounds, and zero wrong algorithm envelopes.
- `npm run validate:ci-missingness:live` found 175 full and 15 valid partial rows, with no insufficient row published.

## Quality gates

- TypeScript passed.
- All 667 repository tests passed.
- The aggregate claims/documentation gate passed.
- The full production build passed. It retained the pre-existing Turbopack broad-file-trace warning from `next.config.ts`.
- Browser checks passed on `/civica-index` and `/civica-index/methodology#uncertainty`.
- The Nauru API returned a three-dimension partial estimate, a null lower and upper bound, `ci-missingness/v1`, and `ci-uncertainty/beta-r4`.
