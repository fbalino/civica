# Civica Index candidate tournament preregistration v2

**Registered:** 2026-07-11T09:31:50Z

**Status:** Locked amendment before winner-selecting analysis

**Machine contract:** `src/lib/ci/tournament-preregistration.ts`

V2 supersedes the v1 protocol without inspecting candidate outcomes. The v1 panel used Freedom House's 0–100 total score, while K1 and the live current Index use the combined Political Rights and Civil Liberties ratings on an inverted 2–14 scale. V2 pins the corrected immutable `ci-research-panel-2000-2024-v2`, the exact publisher-workbook hash, the corrected candidate-set commit, and the panel's new row, coverage, and temporal-break hashes.

All evaluation choices from v1 remain unchanged: six candidates, six baselines, temporal and deterministic geographic splits, six noncompensating gates, candidate-specific thresholds, subgroup and sensitivity plans, missingness and exclusions, Holm confirmatory correction, labelled BH exploratory analysis, simplicity tie-breaking, and the no-winner rule. The complete values are executable in the machine contract. The original readable v1 protocol remains preserved at `plan/research/index-tournament-preregistration-v1.md`.

No conversion between the two Freedom House fields is permitted. The exact ratings series begins in 2006 in the captured workbook; earlier years are structural missingness. Because no final or validation outcome was inspected and all holdout assignments remain untouched, v2 remains confirmatory rather than exploratory.
