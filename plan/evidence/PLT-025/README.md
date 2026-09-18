# PLT-025 — G4 operations-readiness evidence

Status: agent-executable report preparation complete; checklist item remains
open because G4 is blocked.

The canonical report is `data/OPERATIONS-READINESS.md`.

## Current refresh — 2026-09-18

PLT-030 closed after the named September production release, canonical-domain
assignment, application/database/asset health, reader browser checks, and
Twitterbot metadata/image verification. Evidence is retained under
`plan/evidence/PLT-030/production-release-check-2026-09-17.json`; the canonical
capital backup/restore and repeat-safe repair have a separate record there.
Passing hosted PR and main CI evidence is under `plan/evidence/PLT-001/`.

The checklist is 267/312 complete with 45 remaining, 21 open P0, and 42 open
P0/P1 tasks; G4 and PLT-025 remain blocked, with zero evidence gaps, mirror
errors, or waivers. QA-018 and EXP-015 are resolved; QA-019's residual external
record/disposition remains separate from its completed technical rehearsal.
Repository enforcement is now active under ruleset `23623964`; PR #35 passed
its required checks and merged through the normal protected path. EXP-038 and
PLT-031 are reconciled; the latter has retained first ordinary scheduled-apply
evidence for cabinet and the Canadian, German, and French legislative imports.
Existing freshness and optional-classification warnings, provider controls,
and qualified reviews remain explicit. The map is deferred.

## Historical refresh — 2026-07-29

The dedicated release worktree at `b8351519` reran the fixed G4 matrix. All six
commands passed: master-plan integrity, verification-matrix validation, the
unit suite, typecheck, lint, and `npm run build:ci`. The build path was
credential-free; the worktree had no `.env.local` or database variable. It
used the repository's already-installed dependency tree rather than performing
a new network install, so QA-017 remains the separate clean-install proof.
Exact command results and durations are retained in
`plan/evidence/QA-021/g4-runtime-2026-07-29.v1.json`.

The current tracked-tree secret scan reports zero findings. The known
historical Neon owner credential is rotated and freshly rejected on production
main and the retained recovery branch; its invalid bytes remain registered by
hash pending an owner decision on shared-history rewriting.

At that historical checkpoint, readiness was blocked at 256/310 tasks, with 54
remaining, 23 open P0, 50 open P0/P1, zero evidence gaps, zero master-mirror
errors, and zero waivers.

The current QA-018 technical run completed against a disposable Neon child
and exact Vercel Preview candidate, with production explicitly excluded and
untouched. The retained migration, release, cache, protected-route,
idempotent dry-run, freshness, API, and responsive-browser checks passed.
That was the July 29 boundary. QA-018 is now complete; the owner confirmation
and date correction are retained in its evidence directory.

Production subsequently advanced through authoritative head `0051` with a
retained recovery branch. ATL-026 and ATL-027 now have named production release,
exact replay/freshness, public API, and browser evidence; PUL-027 and PUL-043
also have their bounded production closures. Cron remained disabled. No paid
model call, status notification, external review, owner disposition, elapsed
observation, or waiver is claimed here.

## Initial preparation — 2026-07-23

At the initial report checkpoint, the following validators passed:

- route inventory: 109/109 registered route files, no phantom/stale/method
  drift, one documented sign-out warning;
- current-tree secret scan: zero findings across 3,723 tracked files;
- history secret scan: no new secret, 28 exact non-secret historical fixture
  hashes separated from one real known Neon exposure;
- pipeline observability: 39 scheduled and 11 manual production pipelines;
- error monitoring and health/status contracts;
- backup/restore checked-artifact integrity; and
- the nine-migration local deployment/recovery rehearsal contract.

At that historical checkpoint, the generated report was blocked at 246/308
tasks with 27 open P0 and 58 open P0/P1. The dated refreshes supersede
those counts without rewriting the original evidence boundary.
