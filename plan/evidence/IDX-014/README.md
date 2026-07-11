# IDX-014 evidence — dimensionality across levels and slices

`civica-index-dimensionality/v1` runs correlation PCA on the exact four complete K1 dimensions from immutable panel v3. The sample has 2,270 complete country-years, 178 jurisdictions, 13 annual cross-sections from 2012–2024, and 2,083 consecutive changes.

The checked analysis reports assumptions, correlation matrices, all eigenvalues and variance shares, and PC1 loadings for pooled levels, between-country averages, within-country deviations, first differences, every year, three time blocks, six continent slices, and five sufficiently large current-regime strata. Stability summaries report the range of PC1 variance and loading cosine similarity against the pooled model.

PC1 explains 87.3% of pooled levels and 88.1% between countries, but only 52.5% within countries and 35.9% of annual changes. This directly rejects the shortcut that a strong global level factor proves a single longitudinal change construct.

Artifacts:

- `data/releases/index-dimensionality-analysis-v1/result.v1.json`
- `data/releases/index-dimensionality-analysis-v1/table.v1.csv`
- `data/releases/index-dimensionality-analysis-v1/pc1-level-comparison.v1.svg`
- `plan/research/index-dimensionality-results-v1.md`

The analysis SHA-256 is `07b3b8b5513622fb3a7f3fabb8e8e811d0f55ae4f7a642f7f1681cfeb8ddf954`. `npm run validate:index-dimensionality`, focused numerical tests, and TypeScript pass. The validator regenerates and byte-compares every artifact and checks slice coverage and eigenvalue accounting.
