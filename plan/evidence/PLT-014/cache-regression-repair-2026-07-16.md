# PLT-014 immutable-artifact cache regression repair

**Date:** 2026-07-16
**Scope:** the two frozen G2 Atlas download routes only.

## Finding

`npm run validate:cache-consistency` traced both immutable release routes through
`src/lib/api/artifact-response.ts` → `problem-response.ts` →
`error-monitoring.ts` → `db/index.ts`. Although the artifact bytes are frozen,
the shared error helper made an error branch database-dependent, which violates
the `immutable-release` cache contract.

## Repair

`immutableArtifactResponse()` now owns its fixed `ARTIFACT_UNAVAILABLE` JSON
response locally. Its error branch remains `503` and `Cache-Control: no-store`,
but it no longer imports the database-backed monitoring boundary and logs only
the fixed `[release-artifact] unavailable` event. It never logs the underlying
filesystem exception, pathname, connection string, or artifact contents.

## Verification

- `node --import tsx --test src/lib/api/artifact-response.test.ts` — 2 passing
  tests, including byte/header preservation and a seeded secret-bearing
  filesystem exception with a fixed one-field log assertion.
- `npm run validate:cache-consistency` — passed: 167/167 API methods, five
  export modules, 76 DB query functions, and 68 pages close over the cache
  contract with no mutable database path from either immutable artifact route.
- `npm run typecheck` — passed.

No release artifact, credential, exception text, request metadata, or database
state was read or retained as evidence.
