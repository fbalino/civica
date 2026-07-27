# QA-021 Index change-control release note

This evidence records non-semantic type and lint repairs in protected Index
research files. It does not advance the Index method version because it does
not change an input, transformation, weight, model, missingness rule,
uncertainty rule, rank/band rule, published result, disposition, or public
claim.

The change-control hash adapter recognizes only the three exact post-repair
file hashes and maps them to their prior protected hashes. A further byte
change immediately restores normal methodology-drift detection. A dedicated
negative-control test proves both sides of that boundary.
