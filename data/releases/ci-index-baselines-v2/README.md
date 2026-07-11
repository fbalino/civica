# Civica Index tournament baselines v2

V2 supersedes the v1 baseline release and reads the corrected tournament panel. Freedom House is now the exact combined Political Rights and Civil Liberties ratings input used by K1, not the distinct 0–100 total score. The other baseline definitions, split logic, missingness, and rights posture are unchanged.

B0 preserves the complete jurisdiction-year grid. B1 uses native V-Dem. B2 applies each source's declared fixed bounds and direction before a complete-case equal-weight mean. B3 fits a deterministic first correlation-matrix factor on joint development rows only. The manifest contains counts and hashes but no restricted country values. Live validation reproduces every output from the private panel exactly.
