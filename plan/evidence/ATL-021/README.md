# ATL-021 evidence — frozen Atlas research query

Date: 2026-07-23

Release: `atlas-2026-07-11`

Status: complete

## What shipped

- `GET /api/v1/atlas/query` exposes the permitted, normalized rows from the
  checked frozen Atlas release rather than querying mutable production data.
- The closed table set is `jurisdictions`, `facts`, and `sources`. Each table
  has an allowlisted field catalog, deterministic sort order, typed filters,
  bounded pagination, and JSON or CSV output.
- Every response carries release identity, schema and join documentation,
  source-specific rights metadata, and explicit exclusions. Restricted source
  rows, raw publisher payloads, images, constitution text, Atlas alternates,
  Index, and Pulse data remain outside the surface for stated reasons.
- The endpoint uses the durable distributed API rate-limit policy, the shared
  request/error/CORS contracts, and the shared spreadsheet-formula
  neutralization boundary for CSV.
- `/api-docs` documents parameters, response metadata, rate limits,
  pagination, rights, exclusions, and exact recipes used by the published
  case studies.

Primary implementation:

- `src/lib/exports/atlas-query.ts`
- `src/app/api/v1/atlas/query/route.ts`
- `src/lib/api/contract/{registry,schemas,examples}.ts`
- `plan/ATL-021-research-query-access-2026-07-23.md`

## Verification

- `npm run validate:atlas-case-studies` — pass; 11 tests and byte-exact
  reproduction.
- `npm run validate:api-docs` — pass; 20 registered v1 routes.
- `npm run validate:route-inventory` — pass; 108 route handlers registered,
  with the pre-existing documented participant sign-out warning only.
- `npm run validate:route-io-policy` — pass; 186 tests and 172 contracts.
- `npm run validate:rate-limit-policy` — pass; all 172 mapped operations.
- `npm run validate:cache-consistency` — pass; 172 API methods, five export
  modules, and 70 page surfaces closed over the cache contract.
- `npm run validate:verification-matrix` — pass; 266 critical surfaces.
- `npm run validate:numeric-claims` — pass; 62 public numeric claims registered.
- `npm run validate:design-tokens` — pass; zero baseline violations.
- `npm run typecheck` — pass.

The final `npm run validate:claims-docs` pass completed every component gate
except the aggregate unit step: 2,011 tests passed, three skipped, and two
failed on unrelated user-owned working-tree changes (`current Index
change-control baseline is complete` and `no other shared editorial scope
colors bare anchors`). The two route/build contract failures introduced by
ATL-021 were corrected and their 29 focused tests pass.

The query route was also exercised against the real local app:

- matching JSON request: `200`, one France population row;
- valid empty request: `200`, zero rows with schema/rights retained;
- invalid field: `400 INVALID_QUERY`;
- pagination: stable page one/page two cursors over 253 jurisdiction rows;
- CSV: correct headers and the same selected population row.

The tampered-artifact/unavailable path is covered without changing the checked
release: tests reject altered compressed bytes and altered semantic content
before any row can be served.

## Boundaries

- This is a frozen-release research interface, not a live database mirror.
- Access does not grant reuse rights; the response reports source-specific
  terms and points to the canonical rights manifest.
- No deployment, production migration, production write, or external approval
  is claimed by this evidence.
