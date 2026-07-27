# PLT-012 — closed route I/O and content boundaries

PLT-012 makes each canonical route-method cross an explicit request, response, error, and active-content boundary. The policy is executable: a new route, method, input field, raw body reader, unprojected response spread, dynamic exception payload, or unregistered HTML sink fails the build.

## Acceptance mapping

- **Every endpoint has a contract:** `route-io-policy/v1` covers all 100 canonical route files and 159 route-method tuples with 50 named request contracts. The registry includes explicit no-input methods, 26 query schema IDs, 10 path schema IDs, and 14 byte-capped body routes. Reachability-aware AST tests bind every declaration to the exact live parser call, schema ID, media allowlist, byte ceiling, identifier validation, and Pulse idempotency-header parser actually invoked by its route. Comments, unused imports, dead helpers, parser shadows, wrong schemas, and extra media types cannot satisfy the proof; cron/auth boundaries retain their specialized runtime gates.
- **Hostile input is bounded:** JSON and form payloads are read incrementally under route-specific byte limits, decoded as strict UTF-8, checked for prototype keys/depth/node count, and parsed by strict Zod schemas. The raw-query decoder rejects unknown keys, duplicate scalar values, malformed escapes, invalid calendar dates, noncanonical numbers, and excess lengths/counts before database or expensive work.
- **Public output is closed:** admin feeds, Atlas exports, governance evidence, election/indicator CSV, and Pulse coding exports select or project named public fields. Strict response adapters and sentinel tests drop future database columns, private helper fields, internal country IDs, credential hashes, and nested secrets. Whole-table Pulse export selections are forbidden.
- **Stored HTML has one server boundary:** constitution markup reaches API or client-component rendering only as branded `constitution-html/v1` output from the server-only sanitizer. The allowlist constrains elements, attributes, schemes, nesting, malformed markup, and discarded script/style subtrees. The four application `dangerouslySetInnerHTML` sinks are closed and registered; any new sink fails validation.
- **Errors are safe and stable:** expected failures use fixed problem codes or closed route-specific profiles and are noncacheable. Operational routes use the framework-aware shared boundary; Next.js control-flow signals are rethrown, while ordinary unknown failures retain diagnostics only in server logs and return a fixed `503`. Cron, admin mutation/logout, artifacts, redirects, and streams retain their specialized tested boundaries.
- **Secondary content channels are safe:** Pulse article retrieval admits HTTP(S) public networks only, validates every resolved address, pins the validated transport address, revalidates bounded redirects, disables shared socket pooling, forwards only a closed caller-header allowlist, and caps both compressed wire bytes and decoded chunked/compressed bodies. CSV exports neutralize spreadsheet-active text prefixes—including formulas exposed after comma, semicolon, or tab boundaries—while retaining real numeric negatives.
- **Negative and fuzz fixtures are durable:** seeded cases cover malformed bytes/escapes, unsupported or extra media, declared and streamed overflow, invalid UTF-8, prototype keys, deep/large structures, unknown/nested fields, duplicate values, identifier/date/enum/range failures, parser-proof laundering, future-column sentinels, sanitizer exploit strings, private/reserved/mapped addresses, forbidden forwarded headers, redirect rebinding, wire/decoded-size overflow, spreadsheet formulas, and unknown exception secrets.

## Current-source review

`source-review.md` records the official/current material checked on 2026-07-14: `sanitize-html` 2.17.6, OWASP XSS/SSRF/CSV guidance, and the bundled Next.js 16.2 Route Handler and `unstable_rethrow` documentation. The application runtime floor is Node.js 22.12 because the pinned sanitizer parser requires it.

## Protected Index presentation record

The append-only record `closed-route-io-presentation-contract` advances only the protected presentation label to `civica-index-route-io-contract-v31`. Successful and deprecated Index envelopes, calculations, and published research values are unchanged. Input ambiguity is rejected, and errors gain stable machine codes. No Index input, transform, weight, missingness rule, uncertainty rule, score, band, rank, or research row changes.

## Scope preservation

The owner-controlled Uruguay/Ghana/Japan color-photo trials, typography tester, and associated local files are excluded from the PLT-012 policy snapshot, evidence packets, clean verification checkout, stage, and commit.

## Evidence index

- `route-audit.json` — exact inventory and trust-boundary summary
- `source-review.md` — current official security/framework references
- `index-change-control.md` and `index-change-control-metadata.json` — protected Index presentation classification
- `migration-plan.md` and `release-note.md` — deployment, compatibility, and rollback contract
- `browser-check.json` — in-Codex local route smoke evidence

## Verification

The final staged checkout was applied to an isolated clean worktree and verified on 2026-07-14:

- `npm run build:ci` passed the complete credential-free release chain and Next.js 16.2.7 production build; 108 static pages generated. The existing `node:crypto` Edge-runtime warning remains nonblocking.
- `npm run validate:route-io-policy` passed for 100 route files, 159 route-methods, 50 request contracts, 22 operational boundaries, 6 P1 profiles, and 4 HTML sinks; all 177 focused tests passed.
- `npm exec tsc -- --noEmit` passed.
- `npm test` passed: 1,736 tests, 1,733 passed, 3 intentionally skipped, 0 failed.
- `npm run validate:claims-docs` passed all seven claims/documentation categories.
- `npm run validate:design-tokens` passed with no new drift; 209 baselined legacy violations remain.
- `npm run validate:deps` passed the critical-severity gate. The audit still reports 5 lower-severity findings (4 moderate, 1 high) already governed by the dependency policy.
- `npm run validate:index-change-control:run` reproduced `civica-index-route-io-contract-v31` over 108 protected files and reran all 5 declared validations.
- `npm run validate:governance-evidence-review-packet` reproduced 49 artifacts and 11 review questions exactly.
- Scoped ESLint completed with 0 errors and 4 warnings; the warnings are recorded in `queries.ts`, `country-research-export.test.ts`, and `public-http.test.ts` and do not increase the ratcheted lint gate.
- Changed source files pass Prettier after the final formatting pass; `git diff --cached --check` passes.

The production-server smoke record is `browser-check.json`. Codex's in-app browser bootstrap was attempted twice, including one clean runtime reset, but the packaged browser client failed before discovery with `Cannot redefine property: process`. Its troubleshooting guide forbids switching to an unrelated browser backend, so no Playwright fallback was used. Direct HTTP checks then confirmed the public provenance artifact returns `200`; protected API routes fail closed with `503 RATE_LIMIT_UNAVAILABLE` and `Cache-Control: no-store` because the isolated checkout has no distributed rate-limit store. Parser-specific `400` behavior remains covered by the passing integration and fuzz fixtures.
