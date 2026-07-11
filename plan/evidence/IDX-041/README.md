# IDX-041 evidence — K1 publisher uncertainty inputs

`ci-k1-uncertainty-inputs-2024-v2` freezes the 970-cell sovereign-state/source grid needed for 2024 sensitivity scenarios. It retains exact V-Dem v15 credible bounds, WGI 90% intervals for Voice & Accountability and Rule of Law, CPI lower/upper confidence bounds, and an explicit no-distribution state for Freedom House.

The release has 928 observed values and 42 missing values. Bounded coverage is 172 V-Dem, 192 WGI Voice, 192 WGI Rule of Law, zero Freedom House, and 177 CPI rows. Every bound contains its point estimate. There is no imputation.

All four publisher artifacts are URL- and SHA-256-pinned. Values stay private under mixed source terms. The release states that it supports sensitivity scenarios only; missing Freedom House uncertainty and unknown cross-source covariance prevent a calibrated composite confidence interval.

V1 paired exact V-Dem intervals with six mismatched republisher point estimates from panel v3. Its invariant failed and the release remains immutable evidence. V2 uses each publisher's exact point estimate with its own interval, while preserving the republisher/publisher difference for source-substitution analysis.

`npm run validate:k1-uncertainty-inputs` confirms coverage, all 733 point-within-bound invariants, the six preserved v1 failures, exact live hash, and completed-release immutability. Row SHA-256: `58bac490cd025f12adbe175065275bc0c3498d6474725a64eb57585a6d8cf961`.
