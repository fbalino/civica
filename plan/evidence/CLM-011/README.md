# CLM-011 evidence — operational documentation truth

## Outcome

README, AGENTS, DESIGN, `.env.example`, project memory, route examples, cron scope, schema count, and reconciliation-methodology prose now describe the current runtime. The generated README is protected by both a template hash and a rendered-body hash, so editing either source or output without regeneration fails the build.

`npm run validate:doc-references` is deterministic, DB-free, and part of `npm run build`. It validates documented npm commands, direct app routes, repo-relative file pointers, the live Drizzle table count, CRON-secret scope, generated README freshness, the four required project-memory files, and the current Atlas redirect target.

## Closed drift

- README country routes now use `/country/[slug]`, `/country/[slug]/civica-data`, and `/country/[slug]/constitution`; reconciliation uses `/country/methodology/reconciliation`.
- The documented WDI command is the real `sync:factbook:wdi` script.
- AGENTS reports the live 49-table schema and identifies `.env.example` as the complete environment contract.
- CRON-secret descriptions cover every `/api/cron/*` family, including bills, factbook syncs, and Pulse.
- DESIGN no longer cites the redirect-only `/civica-index/changelog` example.
- Project memory names `/country/:slug`, not retired `/factbook/:slug`, as the Atlas country redirect target.
- Reconciliation prose derives its high-volatility threshold from the fact-key registry, computes the frozen Argentina gap, uses current-truth wording, and no longer publishes pre-launch hot-fix/migration narratives or stale Factbook routes.

## Verification

- `npm run validate:doc-references` — pass: 51 npm mentions across eight operational/memory surfaces, 86 route mentions, 49 schema tables, four CRON surfaces, 60 file pointers, both README hashes, and all four project-memory files
- documentation-reference unit fixtures — 37/37, including missing command, redirect-only route, stale README body, and stale project-memory route failures
- reconciliation worked-example fixtures — 9/9
- `npm run validate:doc-sources` — pass
- `npm run validate:content-templates` — pass for all seven migrated files; deferred reconciliation mirror identified explicitly
- `npm run validate:numeric-claims` and `npm run validate:public-claims` — pass
- `npm run validate:design-tokens` — pass with no new drift
- `npm test` — 163/163, including the documentation-reference and reconciliation test files
- targeted ESLint and `git diff --check` — pass
- `npm run build` — pass: compilation, TypeScript, all build validators, and 85 static pages; known pre-existing Turbopack broad-trace warning only
- production desktop-light/mobile-dark browser smoke — pass; see `browser-checks.md`

## Independent work and review

- `SN5 CLM-011 documentation drift audit` — Claude Sonnet 5, read-only inventory
- `OP48 CLM-011 closure-contract adjudicator` — Claude Opus 4.8, acceptance contract
- `SN5 CLM-011 implementation` — Claude Sonnet 5, single implementation writer
- `OP48 CLM-011 independent acceptance review` — Claude Opus 4.8, final PASS with no blockers
- Primary Codex — README body-hash hardening, project-memory coverage, current-truth cleanup, production browser QA, and closure evidence

## Deliberate boundary

CLM-011 validates operational and project-memory references. Public API response examples remain owned by CLM-012, which is the next checklist task.
