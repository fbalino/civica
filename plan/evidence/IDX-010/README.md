# IDX-010 evidence — locked tournament preregistration

Current protocol v3 was registered before outcome inspection. Prior versions remain preserved; v3 pins the exact PR+CL and WGI VA fallback identities and precedence. Splits, gates, thresholds, and decision rules are unchanged.

## Registration

- Protocol: `civica-index-tournament-preregistration/v3`
- Registered: `2026-07-11T09:40:42Z`
- Registration-base commit: `8f18b696250d18d00a30e62f31e31c4fea41f4ac`
- Frozen panel commit: `4aaca7c26ae0a0b26e4ffe05e04ea568282f5cb7`
- Frozen charter commit: `28edebdfea368c9f5938b8483b4fd1645a448ce9`
- Frozen candidate-set commit: `8f18b696250d18d00a30e62f31e31c4fea41f4ac`

The readable amendment is `plan/research/index-tournament-preregistration-v3.md`; the complete executable source is `src/lib/ci/tournament-preregistration.ts`.

## Frozen data and splits

The protocol matches the checked panel manifest's row, coverage, and temporal-break SHA-256 values. It fixes development at 2000–2016, validation at 2017–2020, and final temporal holdout at 2021–2024. Independent geographic assignment hashes an uppercase ISO3 with a fixed salt into ten outcome-free buckets: seven development, two validation, and one final holdout.

## Frozen evaluation

Six candidates, six applicable baselines, six required noncompensating gates, candidate-specific metrics and thresholds, eight subgroup families, ten sensitivity families, no-imputation missingness, explicit exclusions, Holm confirmatory correction, and BH-labelled exploratory correction are fixed. The decision contract allows original measurement, reference product, bounded derivative beta, experimental research, retirement, and no winner. Simplicity breaks practical ties and unresolved ties go to the dashboard.

## Verification

- `npm run validate:index-tournament-preregistration` verifies completeness, hashes, candidate thresholds, and availability of every frozen Git commit.
- Fixtures prove deterministic case-insensitive geographic folding and rejection when a candidate lacks thresholds.
- `npx tsc --noEmit` passes.
- All 681 repository tests pass.
