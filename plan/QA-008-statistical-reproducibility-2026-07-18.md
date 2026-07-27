# QA-008 — Statistical-analysis reproducibility

## Status

Completed 2026-07-18. The Index analysis release stores result hashes,
declared seeds, environment metadata, and release-input manifests. The replay
audit closed two concrete gaps: longitudinal validation no longer fetches
publisher bytes during replay, and subgroup fairness v2 no longer reads live
jurisdiction metadata or private release rows during replay. The audit also
proved that subgroup-fairness v1 cannot be represented as reproducible: its
small-state strata changed after the live population metadata changed. V1 is
therefore immutable historical evidence, not the active replay target.

## Adopted replay boundary

`generate-index-longitudinal-analysis.ts` now reads source bytes only from
`CIVICA_RESEARCH_INPUT_DIR/sha256/<content-hash>` during ordinary validation.
The expected hashes are the checked capture identities in
`ci-longitudinal-validation-inputs/v2`. An explicit
`--allow-network-capture` operation can retrieve a missing source only while
writing the verified bytes to that protected local cache. The cache is ignored
and may never be committed or publicly served.

`npm run validate:statistical-reproducibility` is the aggregate static gate for
nine checked statistical artifacts. It pins the bytes of every result,
registered file input, dimensionality table/figure, semantic result hash,
analysis entrypoint, replay command, and every randomized analysis seed. A
changed input, output, method entrypoint, seed, table, figure, or removed
validator fails rather than silently reusing a prior result. The subgroup v2
result also embeds the content hash of its protected input, while its checked
manifest pins the private-source release identities and public classification
bytes.

`index-subgroup-fairness-v2` is the active replayable subgroup analysis. Its
restricted normalized input snapshot is retained only at
`CIVICA_RESEARCH_INPUT_DIR/sha256/d92c244f4e7d3f4468e2667ed0347da1fddf132be0a4817238dbfe77263bb1e6`.
The checked manifest records that hash, the v2 result records it, and ordinary
replay has neither database nor network access.

The remaining six database-backed analyses share
`ci-index-analysis-replay-inputs-2026-07-18-v1`, a protected normalized
snapshot of the 29,100-row panel, 970 uncertainty rows, 4,357 longitudinal
labels, and 194 metadata rows. Their ordinary generators now read that exact
cache entry only. The shared manifest binds its source-release row hashes; the
analysis validators reproduce their existing frozen results byte-exactly.

## Completion evidence

`CIVICA_RESEARCH_INPUT_DIR=/protected/civica-research-inputs npm run
validate:statistical-replay` runs the static registry plus all nine registered
analysis validators with `DATABASE_URL` removed. The 2026-07-18 isolated
execution passed; its runtime and package-lock identity are recorded in
`plan/evidence/QA-008/replay-environment.v1.json`.

The static registry pins each result, result identity, input manifest,
analysis-entrypoint bytes, derived table/figure bytes, replay command, and
randomized seed. Deliberate cache-byte drift is rejected by the protected-input
tests; deliberate method/input/replay/seed drift is rejected by the registry
fixtures. The tolerance for every registered analysis is byte-exact.
