# QA-008 — Statistical-analysis reproducibility

## Status

In progress. The Index analysis release already stores result hashes, declared
seeds, environment metadata, and release-input manifests. The replay audit on
2026-07-18 established one remaining gap: the longitudinal validator fetched
historical QoG/V-Dem bytes from publisher URLs during validation. A matching
hash fails changed input, but a URL fetch is neither an offline replay nor a
reliable retained-input procedure.

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
validator fails rather than silently reusing a prior result. The relevant
private release manifests retain the expected database-row hashes; the final
replay evidence must verify those hashes against the protected database before
this becomes a closed reproducibility claim.

## Remaining closure work

1. Retain the four approved historical source bytes in the protected cache and
   rerun the longitudinal validator without network access.
2. Apply the same retained-input replay contract to every analytical generator
   still querying a frozen private release directly, including its exact
   protected row hash.
3. Execute the registered validators in an isolated, read-only environment,
   record the environment metadata and tolerances, and demonstrate a changed
   input or method version cannot reuse an old result.
4. Preserve the successful commands, environment metadata, and deliberate
   drift fixtures under `plan/evidence/QA-008/` before checking the task.
