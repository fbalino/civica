# PLT-001 — canonical continuous integration

**Status:** Complete · **Completed:** 2026-07-14

## Outcome

The repository now has one canonical, fork-safe GitHub Actions job named
`verify`. It runs on every pull request and push to `main`, uses the supported
Node 22 runtime, contains no repository secret or database credential, and
executes the same hash-bound build body used by production.

The required order is exact and fail-closed:

1. `npm ci`
2. `npm run validate:ci-workflow`
3. `node plan/tools/validate-master-plan.mjs`
4. `npm run validate:secrets`
5. `npm run validate:deps`
6. `npm run validate:lint`
7. `npm run typecheck`
8. `npm run validate:module-coverage`
9. `npm run build:ci`
10. `npx playwright install --with-deps chromium`
11. `npm run test:e2e -- e2e/harness.selftest.spec.ts e2e/ci-smoke.spec.ts --workers=1 --retries=0`

The former duplicate claims/docs workflow was removed. Its checks remain in
the shared production build core, so there is one authoritative result rather
than two workflows that can drift or disagree.

## Credential-free build contract

Production remains strict: the normal `prebuild` still requires the production
build environment, including `DATABASE_URL`. CI uses a separate `ci` context
and skips only that lifecycle prehook; `build:ci` then executes the exact
unchanged `build` → `build:core` body.

Four mutable database audits now have explicit static/live boundaries:

- Pulse evaluation sampling;
- frozen vintages;
- temporal metadata; and
- Pulse source coverage.

Their normal build commands validate immutable, hash-sealed checked evidence
without Neon. Their explicit `:live` commands compare the same contracts with
current production state. Current live Pulse source coverage was also checked
read-only: 3 feeds operating, 1 degraded, and 6 inactive.

`/governance-evidence` was the one page that reached Neon while prerendering.
The new route layout calls Next.js 16's documented `connection()` boundary, so
the page renders on demand. The sealed review-packet page itself remains
byte-for-byte unchanged and its artifact hash still validates.

## Fail-closed evidence

`src/lib/platform/ci-workflow-contract.ts` binds the entire workflow and the
production build body. Focused tests reject missing, changed, reordered,
duplicated, extra, multiline, or mis-indented commands; trigger drift;
`pull_request_target`; secret/database access; conditional bypasses;
`continue-on-error`; runtime drift; and removal of transitive unit,
claims/docs, or Index change-control gates.

The Playwright harness self-test deliberately creates console, uncaught-page,
asset-404, and route-404 failures and proves the harness observes them. The
bounded CI smoke then checks a static reader route and the generated,
database-independent rights-manifest API against the built production server.

The secret scanner's own live-shaped fixtures were rebuilt from harmless
runtime fragments rather than allowlisted. Two pre-existing lint errors in the
owned CI path were fixed, so the lint ratchet and focused ESLint/Prettier checks
are green.

## Clean-controller verification

Verification ran in an isolated detached worktree with no `.env.local`, no
`DATABASE_URL`, and no provider/admin secrets:

- Node `v22.23.1`; npm `11.7.0`.
- `npm ci` — pass; 635 packages installed from the lockfile.
- Canonical workflow validator — pass; exact 11-command list.
- Plan integrity, current-tree secret scan, dependency policy, lint ratchet,
  TypeScript, and all eight module-coverage gates — pass.
- `npm run build:ci` — pass; every validator, the full unit suite, claims/docs,
  golden tests, and the final Next.js 16.2.7 production build completed.
- Next production build — pass; 108/108 generated pages and
  `/governance-evidence` reported as dynamic/on-demand.
- Exact Playwright install command — pass.
- Production-server Playwright command — **8/8 pass** with one worker and zero
  retries. The first run exposed an ambiguous `footer` locator; the final test
  targets the actual `contentinfo` landmark and passed with the seven other
  harness/API checks.
- Static and explicit read-only live Pulse source-coverage validators — pass.

The in-Codex browser bridge was attempted repeatedly, including once after a
fresh runtime reset, but failed before tab creation with
`Cannot redefine property: process`. The repository's real Playwright harness
was therefore the documented fallback for this run.

## External operation queued, not claimed

The live GitHub check found `main` unprotected, with no ruleset requiring
`verify`, and no hosted run of this new job yet. That repository-setting change
is outside this local implementation. `plan/MANUAL-CHECKS.md` now asks the
owner/platform to push the branch, observe the first hosted pull-request and
`main` runs, and require `verify` through branch protection or a ruleset.

No hosted run or branch-protection change is claimed here.
