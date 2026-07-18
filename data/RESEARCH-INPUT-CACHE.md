# Research input cache

Some statistical analyses use publisher bytes that cannot be committed to this
repository under the applicable source terms. Reproducibility therefore uses a
protected, local cache rather than re-fetching a mutable publisher URL during a
validation run.

Set `CIVICA_RESEARCH_INPUT_DIR` to the directory containing:

```text
sha256/<captured-content-sha256>
```

The filenames are the content hashes recorded in the applicable release-input
manifest. The directory is ignored when it lives at
`data/research-input-cache/`; it must never be committed, bundled, or exposed
through a public route.

For the longitudinal Index study, normal replay (`npm run
validate:index-longitudinal`) reads only this cache and rejects a missing or
mismatched byte stream. A deliberate recapture is explicit:

```sh
CIVICA_RESEARCH_INPUT_DIR=/protected/civica-research-inputs \
  npm run generate:index-longitudinal -- --allow-network-capture
```

That operation verifies each retrieved byte stream against the frozen SHA-256
before retaining it. A changed publisher response fails; it cannot silently
replace the released input.
