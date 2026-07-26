# PLT-025 — G4 operations-readiness evidence

Status: agent-executable report preparation complete; checklist item remains
open because G4 is blocked.

The canonical report is `data/OPERATIONS-READINESS.md`.

## Current refresh — 2026-07-26

A clean source checkout at `2eddeb5d` reran the fixed G4 matrix. All six
commands passed: master-plan integrity, verification-matrix validation, the
unit suite, typecheck, lint, and `npm run build:ci`. The build path was
credential-free; the checkout had no `.env.local` or database variable. The
source checkout reused the repository's already-installed dependency tree
rather than performing a new network install, so QA-017 remains the separate
clean-install proof.

The current tracked-tree secret scan reports zero findings across 3,931 files.
The generated readiness state is correctly blocked at 249/310 tasks, with 61
remaining, 27 open P0, 57 open P0/P1, zero evidence gaps, zero master-mirror
errors, and zero waivers.

The 2026-07-26 QA-018 Vercel CLI isolation probe found that Preview resolves
to the production Neon branch and stopped before any write or migration.
Staging remains external-authority work: enable the prepared Vercel Preview
connection settings, then resume through Vercel CLI only. No Neon Console
sign-in, migration, deployment, production mutation, provider-setting change,
paid model call, status notification, or waiver is claimed here.

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
tasks with 27 open P0 and 58 open P0/P1. The current figures above supersede
those counts without rewriting the original evidence boundary.
