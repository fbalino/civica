# QA-008 — Statistical-analysis reproducibility

## Status

In progress. The Index analysis release already stores result hashes, declared
seeds, environment metadata, and release-input manifests. The replay audit on
2026-07-18 closed two concrete gaps: longitudinal validation no longer fetches
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

## Remaining closure work

1. Apply the same retained-input replay contract to every analytical generator
   still querying a frozen private release directly, including its exact
   protected row hash.
2. Execute the registered validators in an isolated, read-only environment,
   record the environment metadata and tolerances, and demonstrate a changed
   input or method version cannot reuse an old result.
3. Preserve the successful commands, environment metadata, and deliberate
   drift fixtures under `plan/evidence/QA-008/` before checking the task.
