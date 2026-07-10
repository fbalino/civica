# SN5 CLM-017 bounded CI-gate implementation

Project root: `/Users/fernandobalino/Projects/civica`

Role: exact Claude Sonnet 5 single writer for CLM-017.

Task:

> Add a claims-and-documentation CI gate. Done when: one documented command validates registry coverage, numeric templates, internal routes/anchors, API examples, methodology fixtures, experimental labels, and prohibited claim language; the command fails on seeded stale-copy fixtures and runs in CI.

Read `AGENTS.md`, `package.json`, the existing `scripts/validate-*` entry points, and their focused tests. There is currently no `.github/` workflow. Do not use a browser, database, network, or design work.

Implement this bounded architecture:

1. Add a pure typed gate manifest/runner (suggested `src/lib/ci/claims-docs-gate.ts`) with seven named Done-when categories and child checks that reuse existing npm validators rather than duplicating their logic. It must include the full `npm test` suite because those tests carry the real negative/stale-copy fixtures.
2. Add `scripts/validate-claims-docs.ts` and package script `validate:claims-docs`. A normal run must first prove the seeded fail-closed orchestration fixtures, then execute every child validator, report every result, and exit nonzero if any child fails. Avoid recursion: the gate may run `npm test`, but tests must import only the pure runner and never invoke the CLI.
3. Add explicit seeded stale-copy fixtures mapping every required category to the child check that must fail. Pure tests must prove: every category is covered, each seeded child failure makes the overall gate fail, duplicate/missing checks/categories are rejected, and a clean fake run passes. Be precise that existing validator tests prove semantic detection while the seeded gate fixtures prove orchestration cannot swallow a failure.
4. Include these existing behaviors at minimum:
   - registry coverage + prohibited claim language: `validate:public-claims`
   - numeric templates: `validate:numeric-claims`, `validate:content-templates`
   - routes/anchors: `validate:doc-sources`, `validate:doc-references`
   - API examples: `validate:api-docs`
   - methodology fixtures: `npm test`, `validate:pulse-runtime`
   - experimental labels: `validate:metadata` plus public-claim coverage
   - terminology/policy overclaims: `validate:terminology`, `validate:policy-surface`
   - TypeScript may be included; do not include live DB/browser/crawler checks.
5. Add minimal `.github/workflows/claims-docs.yml` for push and pull_request: checkout, setup Node 22 with npm cache, `npm ci`, `npm run validate:claims-docs`. No secrets or database service.
6. Document the single command and what it covers in `README.template.md`, regenerate `README.md`, and add the command to `AGENTS.md` discipline text.
7. Simplify `npm run build` to call the new aggregate command once rather than separately repeating its child validators; keep non-claims guards (`validate:sync-freshness`, replication, editorial illustrations) and `next build` outside it.

Owned files only:

- new gate module/test and CLI script
- `.github/workflows/claims-docs.yml`
- `package.json`
- `README.template.md` and generated `README.md`
- `AGENTS.md`

Do not edit plan checklists/progress/decisions/evidence other than this prompt/result, project memory, orchestrator state, methodology content, application UI, or unrelated files. Do not commit.

Acceptance before returning:

- focused gate tests pass;
- `npm run validate:claims-docs` passes without a database;
- typecheck, targeted ESLint, README/doc-reference validation, and `git diff --check` pass;
- workflow YAML is syntactically coherent and references only existing commands.

Return the normal worker-result schema with complete changed-files and commands-run lists. If execution exceeds the bounded scope, stop with partial status rather than expanding.
