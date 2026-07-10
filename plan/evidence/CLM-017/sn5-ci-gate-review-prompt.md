# SN5 CLM-017 independent acceptance review

Project root: `/Users/fernandobalino/Projects/civica`

Role: exact Claude Sonnet 5, read-only final reviewer. Do not edit files, commit, use a browser, or access the network/database.

Review the uncommitted CLM-017 diff only against this acceptance criterion:

> One documented command validates registry coverage, numeric templates, internal routes/anchors, API examples, methodology fixtures, experimental labels, and prohibited claim language; the command fails on seeded stale-copy fixtures and runs in CI.

Primary owned files:

- `.github/workflows/claims-docs.yml`
- `scripts/validate-claims-docs.ts`
- `src/lib/ci/claims-docs-gate.ts`
- `src/lib/ci/__tests__/claims-docs-gate.test.ts`
- `package.json`
- `README.template.md` and generated `README.md`
- `AGENTS.md`

Check specifically for recursion, false-green/missing-result behavior, dishonest claims about what seeded fixtures prove, workflow secret/DB dependencies, stale action or Node configuration, incorrect build composition, and missing coverage of any required category. Treat existing semantic negative tests invoked by `npm test` separately from the pure orchestration fixtures.

You may run read-only commands and focused tests. Return concise JSON with: `verdict` (`ACCEPT` or `REJECT`), `blocking_findings`, `non_blocking_findings`, `checks_run`, and `rationale`. Reject only for a real acceptance or correctness failure.
