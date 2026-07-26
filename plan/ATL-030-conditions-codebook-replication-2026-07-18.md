# ATL-030 — Conditions codebook and replication boundary

## Status

Complete. The public codebook is available at
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

## Completion evidence

The isolated QA-018 run published `conditions-qa018-20260726-v2`, retained its
capture/file/expectations/manifest hashes, replayed all 340 calculation keys,
and independently reconciled 818 components and 101 scores. An identical-input
rerun inserted zero scores and components; a deliberately altered input failed
closed and left the release and source freshness unchanged.

- `plan/evidence/ATL-030/release-reproduction.v1.json`
- `plan/evidence/ATL-029/release-reconciliation.v1.json`
- `plan/evidence/QA-018/run-06-preview-smoke.v1.json`

The raw World Bank response capture is not committed; the checked packet
retains only hashes, counts, and bounded outcomes. This completes the
release-specific staging criteria without claiming production publication.
