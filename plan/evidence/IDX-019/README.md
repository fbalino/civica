# IDX-019 evidence — full sensitivity and uncertainty grid

The reproducible 2024 grid varies indicator inclusion, V-Dem/WGI and republisher/publisher substitution, V-Dem vintages, fixed-bound versus percentile normalization, current/equal/full-panel-PCA weights, weighted-mean versus median aggregation, complete/permissive missingness, exploratory median imputation, publisher-bound dependence scenarios, winsorization, temporal/geographic folds, and country coverage.

Every point variant reports coverage, common sample, score and rank Spearman correlation, median/p95/max absolute rank displacement, and top-decile Jaccard. Publisher-bound scenarios retain Freedom House at its point estimate and are explicitly nonprobabilistic because its uncertainty and cross-source covariance are unavailable.

The strongest rank drivers are dropping Freedom and Rights (p95 33.2, max 51), dropping Democratic Quality (p95 25.2, max 38), and dropping Rule of Law (p95 23, max 26). Equal and full-panel PCA weights each have p95 movement three. Uncertainty-bound stresses have median movement one and p95 three to 4.2. Exploratory median imputation expands coverage from 193 to 194 but lowers top-decile Jaccard to 0.739.

`npm run validate:index-sensitivity`, `npm run validate:k1-uncertainty-inputs`, focused rank/percentile tests, and TypeScript pass. Result SHA-256: `49576076eaf6920594d4c51290fb0164b8ab8e82abec5e4a7b05ab313aa8b7c6`.
