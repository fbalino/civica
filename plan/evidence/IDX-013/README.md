# IDX-013 evidence — isolated candidates and shared evaluation interface

All six approved tournament paths now have isolated implementations and one checked summary contract, `civica-tournament-evaluation-interface/v1`:

| ID | Output kind | Frozen implementation |
|---|---|---|
| K0 | Native-source dashboard | Baseline B0 over panel v3 |
| K1 | Composite estimate | `k1-current-composite-tournament/v1` |
| K2 | Rater-concordance profile | `k2-measurement-concordance/v1` |
| K3 | Power/transfer ledger state | `k3-power-transfer-ledger/v1` |
| K4 | Constitution/practice evidence pair | `k4-constitution-practice-pairings/v1` |
| K5 | Institutional-relation coding candidate | `k5-institutional-constraint-map/v1` |

The shared interface names the output unit and kind, exact input release, possible/emitted/missing unit accounting, development/validation/final-holdout coverage, evidence coverage, uncertainty posture, private output hash, value location, held-out-label access, and validation state. It fails if split counts do not close, a possible-unit grid does not reconcile, a hash is invalid, private values are marked public, holdout metrics are computed, or a winner is selected.

K3 and K4 were corrected to carry the same preregistered outcome-free geographic split as the other nonpanel candidates. Their new deterministic hashes and split counts are checked in their source manifests and evidence files.

The suite SHA-256 is `9f82c970c1aa4d8b94702bf3da5d1a2c4ae7d10b9e37a8e3477bd8ef471759ca`. It exposes no upstream private values and records that winner selection and held-out outcome metrics have not occurred.

All B0–B3 and K1–K5 live/static reproducibility validators pass, along with the shared interface tests and TypeScript. External validation gates remain separate work and are not represented as completed implementation.
