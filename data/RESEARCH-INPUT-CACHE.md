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
mismatched publisher byte stream. A deliberate recapture is explicit:

```sh
CIVICA_RESEARCH_INPUT_DIR=/protected/civica-research-inputs \
  npm run generate:index-longitudinal -- --allow-network-capture
```

That operation verifies each retrieved byte stream against the frozen SHA-256
before retaining it. A changed publisher response fails; it cannot silently
replace the released input.

The cache also holds restricted *normalized* inputs when a statistical
analysis depends on a frozen private database release or mutable jurisdiction
metadata. These snapshots are likewise content-addressed and are never
committed. Their explicit capture is read-only and records a new hash for a
new analysis release:

```sh
CIVICA_RESEARCH_INPUT_DIR=/protected/civica-research-inputs \
  npm run generate:index-subgroup-fairness -- --capture-live-inputs
```

Normal `npm run validate:index-subgroup-fairness` opens neither the network
nor a database connection. It reads only the hash named by the checked v2
release manifest and fails closed if that exact cache entry is unavailable or
changed.

The remaining Index analysis suite (dimensionality, validity, incremental
information, longitudinal, out-of-sample, and sensitivity) shares a second
protected snapshot. Capture it explicitly:

```sh
CIVICA_RESEARCH_INPUT_DIR=/protected/civica-research-inputs \
  npm run capture:index-analysis-inputs
```

The checked `ci-index-analysis-replay-inputs-2026-07-18-v1` manifest pins its
content hash and source release-row hashes. `npm run validate:statistical-replay`
runs every registered analysis with `DATABASE_URL` removed; normal replay must
not query a database or fetch a publisher URL.
