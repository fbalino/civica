# CLM-012 evidence — generated public API contracts

## Outcome

The public API documentation, response examples, runtime serializers, and contract tests now share one strict Zod schema registry. All 14 live `/api/v1` GET routes and the country bulk-export route are documented from that registry. Examples are generated objects that must parse against the endpoint schema, and route shaping functions parse runtime data rather than acting as TypeScript-only casts.

Deprecated structural-family fields use the canonical constants and helpers in `src/lib/api/deprecation.ts`. Always-deprecated responses emit matching `Deprecation`, `Sunset`, and successor `Link` headers on success and errors. `/api/v1/index/by-government-type` emits them only for `taxonomy=structural|regime`; its normal response remains unmarked. Successful deprecated JSON responses also carry the matching machine-readable metadata block.

## Contract surface

- `src/lib/api/contract/schemas.ts` — strict response and item schemas
- `src/lib/api/contract/shapes.ts` — runtime `schema.parse()` shaping at route boundaries
- `src/lib/api/contract/registry.ts` — endpoint path, parameters, CORS, rate limit, errors, deprecation scope, and example ownership
- `src/lib/api/contract/examples.ts` — generated illustrative payloads
- `src/lib/api/contract/csv.ts` — bulk-export CSV contract
- `scripts/validate-api-docs.ts` — route/docs/schema/example/deprecation/CSV closure guard
- `src/lib/api/contract/__tests__/contract.test.ts` — positive and adversarial fixtures

## Verification

- `npm run validate:api-docs` — pass: 14 live versioned GET routes, 15 registry entries including bulk export, documented parameters/errors/CORS/rate limits, schema-valid examples, branch-correct deprecation, and CSV contract
- live production endpoint matrix — pass: 17 JSON/CSV requests against the current database returned HTTP 200 and passed runtime parsing
- live deprecation headers — pass: countries and legacy structural taxonomy emit the canonical headers; normal by-government-type does not
- API contract fixtures — 21/21, including extra-field rejection and negative deprecation-scope cases
- `npm run validate:numeric-claims` — pass: generated examples remain inside the public numeric-claims guard
- `npm run validate:design-tokens` — pass with no contract-file exemption
- `npm run typecheck`, targeted ESLint, and `git diff --check` — pass
- `npm test` — 184/184
- `npm run build` — pass: compilation, TypeScript, build validators, and 85 static pages; known pre-existing Turbopack broad-trace warning only
- production desktop-light/mobile-dark browser QA — pass; see `browser-checks.md`

## Independent work and review

- `SN5 CLM-012 API contract inventory` — Claude Sonnet 5, read-only route/response inventory
- `OP48 CLM-012 response-schema adjudicator` — Claude Opus 4.8, read-only architecture and acceptance contract
- `SN5 CLM-012 implementation` — Claude Sonnet 5, single implementation writer
- `OP48 CLM-012 independent acceptance review` — Claude Opus 4.8, identified the numeric-claims guard blocker
- Primary Codex — runtime-parse hardening, conditional error-header coverage, numeric-claims closure, live database matrix, browser QA, and evidence
- `OP48 CLM-012 repaired acceptance` — Claude Opus 4.8, final independent recheck

## Deliberate boundary

This task documents and enforces the API that exists. Release-grade downloadable atlas datasets, rights manifests, codebooks, checksums, and clean-room reproduction remain owned by the data and release tasks in the master plan.
