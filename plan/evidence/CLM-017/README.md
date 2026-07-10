# CLM-017 evidence — claims and documentation CI gate

Status: complete on 2026-07-10.

## Outcome

`npm run validate:claims-docs` is now the single documented, DB-free gate for
the seven CLM-017 categories. A typed manifest composes eleven existing
specialist validators without copying their semantic logic:

1. registry coverage;
2. mutable numeric templates;
3. internal routes and anchors;
4. API examples/contracts;
5. methodology fixtures;
6. experimental labels; and
7. prohibited claims, terminology, and policy language.

The CLI first evaluates one clean orchestration fixture and one seeded failure
for each category, then runs every real child. A missing or nonzero child result
fails the whole gate. The full `npm test` child runs the specialist semantic
negative fixtures; the in-process fixtures prove only that orchestration cannot
swallow those failures.

`.github/workflows/claims-docs.yml` runs typecheck and the aggregate gate on
push and pull requests with read-only repository permission, Node 22, npm's
dependency cache, and no database service or secrets. `npm run build` calls the
aggregate gate once while preserving the sync-freshness, replication-surface,
and editorial-illustration guards outside it.

## Verification

- Focused gate suite: 12/12 passed.
- Full suite through the aggregate gate: 323/323 passed.
- All eleven child validators and all seven categories passed.
- `npm run typecheck`: passed.
- Targeted ESLint for the gate module, CLI, and tests: passed.
- `npm run validate:doc-references`: passed.
- GitHub workflow parsed as YAML and its package/workflow contract tests passed.
- `git diff --check`: passed.
- `npm run build`: passed, including 86/86 generated static pages. The existing
  Turbopack broad-trace warning remains unchanged.
- Browser/design QA: not applicable; CLM-017 changes no rendered UI.

## Independent review and routing evidence

- `sn5-ci-gate-implementation-*`: exact Claude Sonnet 5, subscription-first,
  bounded implementation; session `ebbc35b7-ddd5-4bd5-91e0-def974695a87`.
- `tr-ci-gate-recon-*`: the requested Terra route reported that Terra was not
  actually active and stopped before inspection; it is preserved as an
  unsuccessful/unverifiable routing attempt and is not credited as review.
- `sn5-ci-gate-review-result.json`: a literal `sonnet-5` alias was rejected by
  Claude Code before review; the failed attempt is retained rather than
  mislabelled.
- `op48-ci-gate-review-result.json`: exact Claude Opus 4.8, subscription-first,
  read-only acceptance review; session
  `6aacc0d9-40e2-4d91-9635-bd84087c5408`; verdict **ACCEPT**, no blockers.

Primary implementation files:

- `.github/workflows/claims-docs.yml`
- `scripts/validate-claims-docs.ts`
- `src/lib/ci/claims-docs-gate.ts`
- `src/lib/ci/__tests__/claims-docs-gate.test.ts`
- `package.json`
- `README.template.md` and generated `README.md`
- `AGENTS.md`
