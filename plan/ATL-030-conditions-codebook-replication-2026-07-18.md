# ATL-030 — Conditions codebook and replication boundary

## Status

In progress. The public codebook is available at
`/civica-conditions/methodology`, and the Conditions explorer links to it.
It documents the release-specific ledger, source-native economic inputs, the
no-imputation and same-reference-year policies, missingness, nonclaims, and
the fixture commands that exercise the implementation contract.

## Code-facing evidence

- `content/methodology-conditions.md` is the reader-visible prose source.
- `npm run validate:conditions-components` covers the component, release,
  economic-construct, and public-read fixtures.
- `npm run analyze:economic-stability-construct -- --input=<frozen-study-input.json> --output=<result.json>` reruns the frozen economic study without network or database access.
- The public Conditions API and explorer only expose one immutable selected
  release; they never synthesize a current cross-release result.

## Remaining evidence before completion

1. Apply the Conditions migrations in an isolated staging environment and
   publish a captured release manifest plus its source-input hashes.
2. Reproduce that specific release from its retained inputs and independently
   inspect the generated component, coverage, and public-read output.
3. Record the stage URL, release identifier, manifest hash, and validation
   artifacts under `plan/evidence/ATL-030/`; then update the master checklist.

The current configured database does not yet contain the Conditions release
tables, so this task cannot claim a published-release reproduction yet.
