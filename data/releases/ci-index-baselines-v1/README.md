# Civica Index tournament baselines v1

This release records reproducibility metadata for the four preregistered common baselines. It does not publish source values or per-country derived outputs. Those remain reproducible from the private mixed-rights panel.

- B0 preserves the full 4,850 jurisdiction-year grid as a no-score dashboard contract, including country-years where every governed source observation is missing.
- B1 emits the native V-Dem Liberal Democracy Index where observed.
- B2 converts the four declared governance inputs to their fixed common 0–100 directions and takes an equal-weight mean only for complete rows.
- B3 standardizes the same four inputs and fits a deterministic first correlation-matrix factor on development rows only. Validation and final-holdout rows never affect its means, standard deviations, or loadings.

All methods emit the same unit, split, source, missingness, scale, and version envelope. The checked manifest records coverage and cryptographic output hashes. `npm run validate:index-tournament-baselines:live` recomputes every private output and requires an exact manifest match.
