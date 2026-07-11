# PUL-004 evidence

## Outcome

PUL-004 adopts `pulse-pipeline/versioned-lineage-v1`. Every attempted Pulse
stage now receives an immutable, content-addressed run record describing all
applicable method axes:

- methodology, ontology, pipeline, and stage-algorithm versions;
- prompt version or an explicit not-applicable reason;
- configured provider/model set;
- source-basket version and exact source IDs;
- upstream run IDs; and
- completed, partial, or failed outcome counts and retained failures.

Raw items identify their ingest, cluster, and classification runs. Published
events identify classification, current publication-decision, and
corroboration runs. Reviews identify their review run in the append-only audit
log. Stored dimensional outputs identify their computation run. Database
triggers make run payloads immutable and protect write-once lineage fields.

## Retained history

Authoritative migrations `0013_real_bromley.sql` and
`0014_boring_tana_nile.sql` were planned, fingerprinted, and applied to the live
database. Six fixed legacy stage runs now identify retained rows without
guessing any modern method, ontology, prompt, provider/model, source basket,
algorithm, or pipeline version. Legacy and mixed response sets always return
`comparableAsSingleSeries: false`.

The live authoritative ledger is 15/15. The lineage audit reports six legacy
stage identities and zero missing required row links.

## Canonical artifacts

- Version contract and run helpers: `src/lib/pulse/v2/pipeline-version.ts`
- Contract tests: `src/lib/pulse/v2/pipeline-version.test.ts`
- Schema: `src/lib/db/schema.ts`
- Live/static validator: `scripts/validate-pulse-version-lineage.ts`
- Research resolution: `plan/research/pulse-version-lineage-v1.md`
- Public record: `/civica-index/methodology/pulse#version-identity`
- Durable decision: `APR-D112`

## Verification

```sh
npx tsc --noEmit
npm run validate:pulse-version-lineage
npm run validate:pulse-version-lineage:live
npm run validate:pulse-runtime
npm run validate:data-dictionary
npm run validate:authoritative-migrations -- --live
npm run validate:migrations
npm run validate:migration-preflight
npm run validate:api-docs
npm run validate:claims-docs
npm run validate:design-tokens
npm run validate:index-change-control
npm run build
node plan/tools/validate-master-plan.mjs
```

The complete suite passes 760 tests. Live requests to the changelog and country
event endpoints return strict version identities; a discovered internal-ID
response leak was removed, and the Sri Lanka event endpoint now returns 200
with `legacy_only`, `containsLegacy: true`, and
`comparableAsSingleSeries: false`.

## Browser evidence

See `browser-checks.md` and the four viewport screenshots in this directory.

## Deferred boundary

Current-state output pointers may advance to a later immutable run. PUL-035
owns a separate append-only history of every computed numeric output; PUL-004
does not claim that later requirement is complete.
