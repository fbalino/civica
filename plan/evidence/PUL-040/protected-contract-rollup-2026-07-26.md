# PUL-040 protected-contract rollup — 2026-07-26

The append-only Index registry currently ends at v53. This v54 candidate binds
three protected file changes:

- `src/lib/pulse/v2/corroborate.ts` (`weight_or_model`);
- `src/lib/pulse/v2/score.ts` (`weight_or_model`); and
- `src/lib/pulse/v2/runtime-contract.ts` (`presentation`).

The first two are mechanically classified as model changes because those
publishers are protected in that category. Their semantic change is limited to
using the database clock for terminal run and publication timestamps. Event
membership, source counts, confidence calculations, decay, score values,
dimensions, and method identities are unchanged.

The runtime-contract change advances only the historical observed-evidence cut
from 2026-07-22 to 2026-07-26. A read-only production validator confirmed the
date and unchanged observed source IDs. The regenerated prospective-start
artifact remains blocked with only two of five current-method automatic stages
complete; no 90-day clock is running.

The generator uses `--staged` so its snapshot includes only the intended
candidate. Unrelated unstaged presentation work remains outside this record.
