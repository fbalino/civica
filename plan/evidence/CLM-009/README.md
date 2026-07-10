# CLM-009 evidence — canonical documentation sources

## Outcome

CLM-009 establishes a machine-readable registry for methodology and release concepts across reader markdown, TSX rich blocks, API examples, runbooks, project memory, and generated README surfaces. Each registered concept has exactly one canonical path/symbol; mirrors declare how they stay aligned (`generated`, `interpolated/imported`, `contract-test`, or `link-only`).

The Index normalization table is generated from production normalization descriptors, the PCA appendix consumes a deterministic generated analysis snapshot, peer-group minimum size comes from one DB-free constant, and redirect validation reads the same redirect registry as Next.js. Invisible Markdown reference markers keep generated blocks auditable without exposing implementation text to readers.

## Acceptance proof

- `src/lib/docs/doc-concepts.ts` registers 11 concepts, all six required surface kinds, 37 locations, and three linked public-claim IDs.
- `scripts/validate-doc-sources.ts` fails on registry invariant violations, generator drift, formula copies outside generated blocks, stale redirects/routes, missing anchors, and broken registered cross-document links.
- Negative fixtures prove that a newly duplicated canonical formula and a stale route fail validation.
- `npm run generate:ci-normalization-table -- --check` and `npm run generate:pca-analysis -- --check` byte-compare checked-in generated artifacts.
- Wide methodology tables use the shared `.editorial-table-scroll` primitive for both markdown- and TSX-authored tables. Final 390px browser checks prove all right-hand columns are reachable without document overflow.

## Verification

- `npm run generate:ci-normalization-table -- --check` — pass
- `npm run generate:pca-analysis -- --check` — pass
- `npm run validate:doc-sources` — pass: 11 concepts, six surface kinds, 37 locations, four formula fingerprints across 13 surfaces, 33 redirects with zero stale, 47 cross-document links with zero broken
- `npm run validate:content-templates` — pass: seven migrated files, zero unresolved paths/fallback defects
- `npm run validate:design-tokens` — pass: no new drift
- `npm test` — pass: 149/149
- targeted ESLint — pass
- `npm run build` — pass: TypeScript and 85 static pages; known pre-existing Turbopack broad-trace warning only
- `git diff --check` — pass
- production Chromium QA — pass; see `browser-checks.md`

## Independent work and review

- `SN5 CLM-009 documentation-source audit` — Claude Sonnet 5, read-only concept/duplication ledger
- `OP48 CLM-009 registry architecture` — Claude Opus 4.8, binding architecture and reconciliation
- `SN5 CLM-009 implementation` — Claude Sonnet 5, single implementation writer
- `OP48 CLM-009 independent acceptance review` — Claude Opus 4.8; repair requested, then PASS
- `SN5 CLM-009 browser acceptance repair` — Claude Sonnet 5, invisible markers and shared markdown table wrapper
- `TR CLM-009 browser QA` — GPT-5.6 Terra, initial browser defect discovery
- `SP53 CLM-009 production recheck` — GPT-5.3 Codex Spark; discarded because its Playwright script ignored the requested mobile viewport and missed the control's real accessible name
- Primary Codex — corrected production browser measurements, wrapped the remaining TSX tables, inspected screenshots, and performed final verification

## Deliberate deferrals

- Reconciliation threshold documentation and stale schema-table counts remain owned by CLM-011.
- API v1 example generation/contracts remain owned by CLM-012.
- The unified CI workflow remains owned by CLM-017.
