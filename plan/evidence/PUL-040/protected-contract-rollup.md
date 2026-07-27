# Post-v48 protected-contract rollup

The append-only Index change-control registry last recorded the ATL-014
source-native comparison state. Since that record, seven protected files in
the committed tree changed through already-evidenced Atlas, platform,
accessibility, Conditions, API, and Pulse work:

- `src/lib/data/production-adapter-registry.ts` (`input`);
- `src/app/(reader)/civica-index/methodology/page.tsx` (`presentation`);
- `src/app/(reader)/country/[slug]/civica-data/page.tsx` (`presentation`);
- `src/lib/api/contract/registry.ts` (`presentation`);
- `src/lib/api/contract/schemas.ts` (`presentation`);
- `src/lib/api/contract/examples.ts` (`presentation`); and
- `src/lib/pulse/v2/runtime-contract.ts` (`presentation`).

This v49 entry closes that accumulated registry drift and includes the PUL-040
observed-evidence-cut correction. It does not change an Index score, source
value, normalization, weight, missingness rule, uncertainty calculation, band,
rank, published release, or production database row.

The generator used `--staged`, so its protected snapshot came from the Git
index. This deliberately excludes an unrelated unstaged protected UI edit
while retaining every committed protected-file change plus the staged
PUL-040 runtime correction.

The declared validation set is the complete required `input` plus
`presentation` set, with the Pulse runtime and prospective-start checks added.
