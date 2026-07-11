# IDX-005 evidence — tie and rank semantics

## Adopted policy

`ci-rank/competition-rounded-score-v1` ranks the published integer composite. Equal scores share rank; the next rank skips the positions occupied by the tied group. Jurisdiction ID only stabilizes display order inside a tie and creates no ordinal distinction.

The current release does not have a valid score-uncertainty model, so rank intervals or rank-instability estimates would be invented. The API therefore reports `rank_uncertainty: not_estimable_without_valid_score_uncertainty`, and the methodology states this limitation directly.

## Live and deterministic evidence

- Beta-R5 contains 190 composites and uses competition ranking across 61 tied score groups.
- `npm run validate:ci-ranking:live` verifies every group's rank against occupied positions.
- Two focused fixtures prove exact competition ranks, skipped positions, stable tied display order, and input-order invariance.
- `npm run reproduce:ci-current -- --write` reproduced all 745 dimensions and 190 composites with zero errors or unexplained rows.
- Dimension hash: `6dd1ebe3b7b5e29d190bdc52595e06d5776068b5cbbfa7adbb0b04239f72923d`.
- Composite hash: `109f70af2629f9af6b5af29d89f94280f302a1fa0d1d1461e136e47238c31e35`.

## Surfaces and gates

- The leaderboard marks tied ranks and supplies accessible “Tied rank” labels.
- Country score panels use “Shared rank” for tied estimates.
- API methodology metadata names the ranked quantity, competition method, absence of a rank tiebreaker, nonordinal display ordering, and unestimable uncertainty state.
- All 669 repository tests pass.
- The aggregate claims/documentation gate and full production build pass.
- Browser checks passed on the Index leaderboard and country Civica-data routes. The only observed hydration warning came from `agent-browser` injecting `data-__ab-ci` attributes, not from application markup.
