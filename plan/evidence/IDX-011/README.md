# IDX-011 evidence — executable tournament baselines

Current release `civica-index-baselines/v2` reads corrected tournament panel v2. Baseline v1 remains preserved.

## Implemented baselines

- B0 source-native dashboard/no score: 4,850 jurisdiction-year units, preserving explicit fully missing rows
- B1 best single established indicator: 4,298 native V-Dem LDI observations
- B2 equal-weight common-scale mean: 2,206 complete four-source units
- B3 first common factor: 2,206 complete four-source units, fitted on 535 joint-development units only

The common interface records baseline ID, unit, ISO3, year, joint tournament split, output value or intentional no-score null, scale, observed and missing source identities, and method version. B2 and B3 never impute incomplete inputs.

## Reproducibility and rights

The checked release at `data/releases/ci-index-baselines-v2/` contains coverage and cryptographic output/model hashes, not source values or country outputs. The private panel supplies 19,400 four-source cells, of which 14,849 are observed. `npm run validate:index-tournament-baselines:live` recomputes B0–B3 and requires an exact byte-equivalent manifest.

## Verification

- Focused tests prove shared contracts, complete-case behavior, full-grid missingness, development-only fitting, input-order invariance, and deterministic factor orientation.
- `npm run validate:index-tournament-baselines` passes statically.
- `npm run validate:index-tournament-baselines:live` reproduces the checked private hashes exactly.
- `npx tsc --noEmit` passes.
- All 684 repository tests pass.
