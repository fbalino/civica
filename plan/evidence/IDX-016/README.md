# IDX-016 evidence — incremental information

The prediction protocol was committed in `ccb750b` before results. It freezes development-only fitting, a common complete final-holdout sample, V-Dem/equal-weight/factor/public-input comparators, R²/RMSE/MAE, 2,000 jurisdiction-cluster bootstrap samples, and the adverse originality rule at public-input R² ≥ 0.90.

On 901 final-holdout rows across 172 jurisdictions, the four-public-input model reaches R² 0.999847 (95% interval 0.999809–0.999873). The equal-weight baseline reaches 0.999770, the first factor 0.994664, and V-Dem alone 0.928526. K1 therefore fails the original-information gate by a wide margin.

The analysis explicitly predicts K1, not governance outcomes. Decision utility remains untested and cannot be inferred from reproduction accuracy. K2–K5 retain insufficient benchmark states rather than receiving proxy targets.

`npm run validate:index-incremental-preregistration`, `npm run validate:index-incremental-information`, focused regression/bootstrap tests, and TypeScript pass. Live regeneration matches result hash `d723adf25baf589ec4c53bbab7ef85fcb0429f5fddd36edebff73f42ce7b48fb`.
