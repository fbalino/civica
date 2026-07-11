# PUL-005 evidence

## Outcome

PUL-005 adopts `pulse-raw-evidence/v1`. Each Pulse raw item is now an
immutable private evidence snapshot that binds:

- exact item URL and retrieval time;
- the fetched payload and extracted evidence used by the pipeline;
- content and content-addressed identity hashes;
- source-declared language or explicit `und`;
- publisher and source-family identity;
- ingest-time country label, jurisdiction result, evidence, and resolver
  version; and
- the source terms, review status, redistribution posture, and restrictions
  recorded at capture.

Each event-source row must point to one raw snapshot. Database triggers reject
changes to or deletion of the source content and evidence identity while still
allowing later pipeline annotations in their own fields.

## Rights boundary

Every snapshot records `publicPayloadDistribution: blocked`. The event and
changelog APIs expose the URL, hashes, retrieval metadata, attribution, rights,
and retention policy. They do not expose title, body, or raw publisher payload.
A later public release requires a separate verified source-rights decision.

## Live migration and coverage

Authoritative migration `0015_steep_cyclops.sql` was replayed on a clean local
PostgreSQL database, planned with zero writes, and applied to production. The
authoritative ledger is 16/16 with schema fingerprint
`0eb41c2fc66843e9e4e9beeeee0c2105ee151009e1617d06e1272564f1c8b88e`.

The live audit reports 1,379 raw snapshots and 529 event-source links with zero
missing locators, duplicate identities, malformed envelopes, hash mismatches,
missing raw links, or source mismatches. The Sri Lanka event and changelog APIs
return the exact retained Amnesty evidence identity with no payload leak.

## Canonical artifacts

- Identity builder: `src/lib/pulse/v2/evidence-identity.ts`
- Contract tests: `src/lib/pulse/v2/evidence-identity.test.ts`
- Schema and immutability: `src/lib/db/schema.ts` and
  `drizzle/authoritative/0015_steep_cyclops.sql`
- Live/static validator: `scripts/validate-pulse-evidence-identity.ts`
- Resolution: `plan/research/pulse-evidence-identity-v1.md`
- Public record: `/civica-index/methodology/pulse#evidence-identity`
- Durable decision: `APR-D113`

## Verification

```sh
npx tsc --noEmit
npm run validate:pulse-evidence-identity
npm run validate:pulse-evidence-identity:live
npm run validate:authoritative-migrations:live
npm run validate:research-evidence-retention
npm run validate:rights-manifest
npm run validate:source-input-manifest
npm run validate:data-dictionary
npm run validate:api-docs
npm run validate:claims-docs
npm run validate:design-tokens
npm run validate:index-change-control
npm run build
node plan/tools/validate-master-plan.mjs
```

The complete suite passes 764 tests. The new validator is part of the
production build chain.

## Browser evidence

See `browser-checks.md` and the four viewport screenshots in this directory.

## Deferred boundaries

PUL-007 owns source-family independence and republication detection. PUL-012
owns richer multi-country and separately versioned attribution decisions.
PUL-005 preserves their immutable evidence inputs without claiming those later
tasks are complete.
