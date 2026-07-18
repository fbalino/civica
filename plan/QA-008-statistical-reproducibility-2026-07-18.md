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

## Remaining closure work

1. Retain the four approved historical source bytes in the protected cache and
   rerun the longitudinal validator without network access.
2. Apply the same retained-input replay contract to every analytical generator
   still querying a frozen private release directly.
3. Add the single aggregate QA-008 command that reruns all registered analyses,
   records versions/seeds/tolerances/input hashes, and proves a changed input
   or method version cannot reuse an old result.
4. Preserve the successful commands, environment metadata, and deliberate
   drift fixtures under `plan/evidence/QA-008/` before checking the task.
