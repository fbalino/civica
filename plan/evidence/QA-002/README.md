# QA-002 — Module-scoped test-coverage thresholds

## Outcome

QA-002 is complete. `npm test` had no coverage tool wired in, so the only
number available was "however much of the repo happens to be exercised" — a
single global percentage that hides whether the modules that actually matter
(admin auth, resolver logic, the Index math, the templating engine) are
well-tested. Named high-value modules now have declared, per-module
line/branch/function coverage thresholds, enforced with Node's native
`--experimental-test-coverage` (Node v25, no new dependency), and a seeded
coverage regression demonstrably fails the gate.

## What's registered

`scripts/module-coverage-config.json` declares 8 modules, each with its own
test file(s), the source file(s) it measures, and a lines/branch/functions
floor set below its measured baseline (2026-07-12):

| Module | Lines | Branch | Functions | Why it's high-value |
| --- | --- | --- | --- | --- |
| `admin-session` | 92.89% (>=85) | 90.48% (>=80) | 79.17% (>=70) | Admin-auth cookie HMAC verify — PLT-027 |
| `outcomes-reducer` | 100.00% (>=90) | 85.71% (>=75) | 100.00% (>=90) | Country Outcomes tab state machine |
| `markdown-substitute` | 100.00% (>=90) | 94.44% (>=85) | 100.00% (>=90) | `{{state.*}}`/`{{stats.*}}`/`{{ctx.*}}` templating engine behind seven reader pages |
| `peer-grouping` | 89.65% (>=80) | 87.00% (>=75) | 83.02% (>=70) | peer-grouping-resolution-v1 material/governance peer lenses |
| `ci-worked-examples` | 69.65% (>=60) | 86.36% (>=75) | 82.81% (>=70) | Civica Index v2 composite — published-methodology worked examples |
| `rights-manifest` | 95.04% (>=85) | 94.87% (>=85) | 81.48% (>=70) | Source/field/product/release rights contract (`/licensing#rights-manifest`) |
| `data-value-state` | 100.00% (>=90) | 87.10% (>=75) | 100.00% (>=90) | data-value-state/v1 seven-state availability contract |
| `reconcile-resolver` | 87.39% (>=80) | 72.46% (>=65) | 79.69% (>=70) | source-precedence/v1 canonical-fact resolver |

Full machine-readable numbers: `plan/evidence/QA-002/coverage-report.json`.
Captured CLI output: `plan/evidence/QA-002/coverage-report.txt`.

Thresholds sit meaningfully below the measured baseline (not equal to it) so
normal test additions don't need constant threshold bumps, while a real
coverage drop on the *named module* — not diluted by the rest of the
repository — still fails the gate. `ci-worked-examples`'s lines threshold is
lower than the others because `calculate-v2.ts` retains lower-coverage legacy
(v1) code paths alongside the v2 composite under test; this is documented in
its config `note`, not hidden.

## Code changes behind the two new testable modules

- **`src/lib/admin/session.ts`** — extracted the cookie-parse/HMAC-verify
  branch logic out of `getAdminSession()` into a new exported pure function,
  `verifySessionCookie(cookieValue, secret)`. `getAdminSession()` now calls
  it and returns the same result — behavior-preserving; every branch is
  byte-for-byte the same logic, just reachable without Next.js request
  context. Covered by `src/lib/admin/session.test.ts`, which round-trips
  through the real `buildAdminCookieHeaders()` cookie minter (not a
  reimplementation of the HMAC) to exercise valid, tampered-HMAC,
  tampered-nonce, malformed, missing, and secret-rotation cases. (There is no
  timestamp encoded in the cookie value itself — wall-clock expiry is a
  Set-Cookie `Max-Age` the browser enforces — so "expired" is covered as
  documented secret-rotation invalidation, the module's own stated expiry
  mechanism, not a literal encoded-timestamp check that doesn't exist.)
- **`src/components/outcomes/CountryOutcomeBars.tsx`** — `outcomesReducer`
  (+ its `OutcomesState`/`OutcomesAction`/`OutcomesPayload`/`MetricRow`/
  `PeerStats` types) moved to a new sibling module,
  `src/components/outcomes/outcomesReducer.ts`, with **no logic change**,
  and `CountryOutcomeBars.tsx` re-exports `outcomesReducer` and its state/
  action types from there. This was necessary, not cosmetic: the component
  file imports a CSS Module (`./CountryOutcomeBars.module.css`), which
  Node's native test runner has no bundler to resolve — importing the `.tsx`
  file directly throws `SyntaxError: Unexpected token '.'` inside the CSS
  file. Extracting the pure reducer into its own React/CSS-free module makes
  it importable by `node --test` while the component still exports the same
  symbol for any existing caller.

## Seeded-regression proof

`scripts/validate-module-coverage.test.ts` builds two tiny fixture
module+test pairs at test time (in a scratch directory under `scripts/`,
deleted afterward) — one exercises every branch of both exported functions,
the other calls the module once with a single trivial argument — and asserts
`runModuleCoverage()` (the exact function the CLI uses per module) PASSES the
well-covered fixture and FAILS the under-covered one under the *same*
thresholds:

```
WELL:  passed=true,  exitCode=0, measured={lines:100,   branch:96.43, functions:100}
UNDER: passed=false, exitCode=1, measured={lines:100,   branch:93.75, functions:90}
```

Manual demonstration against the real config (captured, then reverted —
`git status` confirms no residual diff): raising `admin-session`'s functions
threshold from 70 to 99 flips the CLI to `[FAIL] admin-session ... Error:
79.17% function coverage does not meet threshold of 99%.` and the process
exits 1 with `FAIL — 1/8 module(s) below their declared coverage threshold:
admin-session`; reverting the config returns to a clean `PASS — all 8
registered modules meet their declared thresholds.` / exit 0.

### A real bug this proof caught

Building the seeded-regression test surfaced a genuine bug in
`runModuleCoverage()`: when it's called from *inside* a test that is itself
running under `node --test` (exactly what
`validate-module-coverage.test.ts` does), the parent process carries
`NODE_TEST_CONTEXT=child-v8` in its environment. `child_process.spawnSync`
inherits the parent's env by default, so the nested `node --test` child
inherited that variable, tripped node's own "test runner called recursively"
guard, and silently skipped running any files — printing a warning, no
coverage report, but *still exiting 0*. `runModuleCoverage()` now spawns the
child with `NODE_TEST_CONTEXT` (and `NODE_V8_COVERAGE`) stripped from its
environment. Confirmed with three repeated runs of the seeded-regression test
before and after the fix.

## Why module-scoped, not one global number

`--experimental-test-coverage`'s threshold flags
(`--test-coverage-lines/branches/functions`) gate on the *aggregate* across
whatever `--test-coverage-include` scopes into that one invocation — verified
directly: running `ci-worked-examples`'s four-file include set with
`--test-coverage-lines=60` passes even though one of the four files
(`calculate-v2.ts`) individually measures 52.15%, because the combined
aggregate (69.65%) clears 60%. Registering ONE module with a repo-wide
include glob and one threshold would therefore average away a regression in
any single named module. `scripts/validate-module-coverage.ts` instead spawns
one child `node --experimental-test-coverage` process **per registered
module**, each scoped to only that module's own test file(s) and source
file(s), so a drop in, say, `admin-session`'s coverage cannot be masked by
`data-value-state` staying at 100%.

## A measured caveat, documented rather than hidden

Node's `--experimental-test-coverage` under `tsx`'s esbuild-based CJS
transform can misattribute *line*-level coverage onto adjacent
comment/blank-source lines for some files (confirmed against real project
files by re-running `safe-redirect.ts` with a deliberately minimal test:
branch/function percentages tracked the real reduction in test exercise
exactly — 86.67%→55.00% branch, 100%→80% functions — while the *line*
percentage of an identical file copy tested identically differed by several
points depending on file path/name alone). Branch and function percentages
were consistently reliable across every real target module measured for this
task; line percentages occasionally undercount by a few points on comment-
heavy files. Thresholds in `module-coverage-config.json` are set with that
margin in mind, and the config's `note` field records the measured baseline
so drift is visible on inspection, not just on gate failure.

## `package.json` handoff

This task's rules prohibit editing `package.json`. The exact script line to
add (agent instructions specify the name and this exact invocation):

```json
"validate:module-coverage": "tsx scripts/validate-module-coverage.ts",
```

Once added, `.github/workflows/claims-docs.yml`'s new
`- run: npm run validate:module-coverage` step (added in this task) will
run it in CI. Until the script line is added, the step can be run directly
with `npx tsx scripts/validate-module-coverage.ts` (this is how it was
verified for this evidence).

## Verification run

- `npx tsc --noEmit` — clean, no new errors (repo-wide, including the
  `outcomesReducer.ts` extraction and `session.ts` refactor).
- `node --import tsx --test src/lib/admin/session.test.ts` — 20/20 pass.
- `node --import tsx --test src/components/outcomes/outcomesReducer.test.ts`
  — 10/10 pass.
- `node --import tsx --test src/lib/content/markdown/substitute.test.ts` —
  24/24 pass.
- `node --import tsx --test scripts/validate-module-coverage.test.ts` — 5/5
  pass (including the seeded-regression proof), repeated 3x for flake-free
  confirmation after the `NODE_TEST_CONTEXT` fix.
- `npx tsx scripts/validate-module-coverage.ts` — 8/8 modules PASS, exit 0.
  Manual seeded-failure demonstration against the real config (documented
  above) — exit 1, then reverted cleanly.
- Full repo suite: `node --import tsx --test "src/**/*.test.ts"
  "scripts/**/*.test.ts"` — **1256/1256 pass**, 0 failures.
- No `npm run build`, `next build`, or dev-server restart was run per this
  task's rules; no npm dependency was installed.
