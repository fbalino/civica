# PCA claim-scope migration

## Choice of completion path

IDX-037 permits either a new full panel with the declared five-variable factor and rotation work, or a complete narrowing of public claims to the analysis that actually ran. Civica already has a reproducible four-input temporal PCA, but it has no frozen Administrative Capacity input and no five-variable rotation. This release takes the claim-narrowing path rather than manufacturing the missing analysis.

## Historical run

The Phase 5.3 analysis remains immutable evidence for how the archived Beta weights were obtained: squared PC1 loadings from 46 complete 2023 country profiles, rounded to two decimals. It may support statements about correlations and components in that sample. It cannot establish a universal latent construct, a longitudinal change factor, broader-country stability, or a fifth-dimension decision.

The checked source `analysis/phase-5-3/results.json`, its generator, and the public generated snapshot now carry that same boundary. The numeric eigenvalues, correlations, loadings, and historical weights are unchanged.

## Later evidence

`index-dimensionality-analysis-v1` uses the frozen 2000–2024 panel and a declared Pearson correlation PCA. It covers pooled levels, between-country averages, within-country deviations, annual differences, yearly cross-sections, time blocks, regions, and descriptive regime slices. The first component remains strong for country levels and materially weaker for annual change. This evidence narrows interpretation; it does not retroactively validate the old weighting recipe.

## Fifth dimension

Neither analysis includes WGI Government Effectiveness or Regulatory Quality as a fifth input. No public surface may describe Administrative Capacity as distinct, redundant, selected, rejected, or conditionally adopted on the strength of these runs. A future decision requires a new frozen input release, declared factor/rotation method, and versioned result.

## Rollback

The numeric historical artifacts are preserved. Restoring the removed latent-factor or fifth-dimension claims would require a new Index change record and evidence from the analysis those claims describe; reverting prose alone is not a valid rollback.
