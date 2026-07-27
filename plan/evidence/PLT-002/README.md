# PLT-002 — deterministic, enforceable lint

Completed 2026-07-12.

## What was already in place
- The eslint flat config (`eslint.config.mjs`) already ignores generated trees:
  `.next/**` (default) and `.claude/worktrees/**` (agent worktrees lint from
  their own root), so generated/build artifacts are excluded without hiding
  owned source.
- `npm run lint` is deterministic and bounded: a full-project run completes in
  ~18s (declared ceiling 120s).

## What this task adds
`npm run lint` alone exits non-zero on a pre-existing backlog of 29 errors
(21 `no-explicit-any`, 2 `no-require-imports`, 1 `next/no-html-link-for-pages`)
plus tolerated warnings, so it cannot gate CI as-is. Per AGENTS.md ("tolerate
the pre-existing repo-wide lint failure; do not fix unrelated lint just to make
a commit green") and the sanctioned design-token-baseline pattern, this task
adds a **ratchet baseline** rather than a wholesale rewrite:

- `scripts/lint-baseline.json` — the 29 known errors keyed by `<file>\t<ruleId>`
  (line-independent so edits above a violation don't churn it), 22 file/rule
  groups.
- `scripts/validate-lint.ts` / `npm run validate:lint` — runs `eslint -f json`,
  aggregates errors by file+rule, and fails on any NEW key or a higher count on
  an existing key. Fixed entries are reported as ratchet opportunities. The
  baseline may only ratchet DOWN.

## Verification (2026-07-12)
- `npm run validate:lint` → PASS ("29 baselined errors across 22 file/rule
  groups; backlog only ratchets down").
- Seeded a new source violation (`src/lib/__plt002_seed__.ts` with two `any`s)
  → `validate:lint` FAILED with exit 1 and
  `NEW lint error(s): src/lib/__plt002_seed__.ts — @typescript-eslint/no-explicit-any (2, baseline allows 0)`.
  After removing the seed → PASS again.
- `npx eslint scripts/validate-lint.ts` clean; `npx tsc --noEmit` clean.

## Remaining
- Wiring `validate:lint` as a required CI check is PLT-001's job.
- The 29-error backlog is a tracked ratchet, not resolved; each future cleanup
  tightens `lint-baseline.json` downward.
