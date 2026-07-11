# Index incremental-information results v1

**Protocol:** `civica-index-incremental-information/v1`  
**Result hash:** `d723adf25baf589ec4c53bbab7ef85fcb0429f5fddd36edebff73f42ce7b48fb`

## Result

K1 fails the preregistered original-information gate. A development-fitted linear model over its four public inputs reproduces the rounded K1 score on 901 complete final-holdout rows with R² 0.99985 (95% jurisdiction-cluster bootstrap interval 0.99981–0.99987), RMSE 0.295, and MAE 0.255 points. The failure threshold was R² 0.90.

| Comparator | Final-holdout R² | RMSE | MAE |
|---|---:|---:|---:|
| V-Dem LDI | 0.92853 | 6.385 | 5.170 |
| Equal-weight four-input mean | 0.99977 | 0.362 | 0.296 |
| First common factor | 0.99466 | 1.745 | 1.363 |
| Four-input linear model | 0.99985 | 0.295 | 0.255 |

The equal-weight baseline already reproduces nearly all K1 variance. The fitted four-input model improves R² over V-Dem by 0.0713, but that gain reconstructs the formula rather than predicting an external governance outcome. It shows that K1 is derivative and easily approximated, not that it adds new evidence.

This result does not decide whether a transparent derivative summary is useful to readers. The frozen utility gate requires a separate human task study showing at least 10 percentage points better task performance or 20% lower median completion time without comprehension loss. That test has not run.

K2's expert-label comparison with its midpoint/source-count baseline is pending. K3–K5 lack their construct-matched public benchmark labels. They remain insufficient for incremental-information evaluation.

## Disposition boundary

The current composite cannot qualify as an original Civica measurement under the charter. It may still compete later as a clearly derivative convenience summary if it passes utility, reliability, coverage, misuse, rights, and reproduction gates. The source-native dashboard remains the simpler floor product and wins an unresolved tie.
