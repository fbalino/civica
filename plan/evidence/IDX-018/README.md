# IDX-018 evidence — temporal and geographic out-of-sample validation

The checked OOS artifact reads the frozen v3 split and the committed K0–K5 manifests. K1's complete final-holdout reproduction R² is 0.999847 (95% interval 0.999809–0.999873), failing originality. K2's final drop-one-rater instability is 0.6317 (0.5603–0.7004), failing its 0.15 threshold.

K3–K5 retain their preregistered geographic folds and explicit insufficient-label states. The 25-jurisdiction geographic holdout has no region or current-regime subgroup at n≥30; every subgroup performance estimate is therefore suppressed and only sample counts are reported.

`npm run validate:index-oos-validation`, all upstream candidate validators, and TypeScript pass. The result reproduces at SHA-256 `8cd1f8c218b5ccf080168c2c896d7f5dc07673001801291924e2396f2a55ba45`, and `winnerSelected` remains false.
