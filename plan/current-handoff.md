# Current handoff — Civica

**Updated:** 2026-09-17
**Current objective:** repair recurring data updates and reduce routine delivery noise under PLT-031, as authorized on 2026-09-17. The map and external academic review remain outside this engineering work.

## Current release work

- Twenty-three obsolete remote branches were removed and eleven obsolete or deferred pull requests were closed. Deferred major toolchain upgrades were not merged; their links and exact heads remain in `plan/evidence/PLT-030/branch-cleanup-record-2026-09-17.json`.
- The critical dependency repair is merged in PR #29. All configured checks and its Vercel preview passed; the replacement September production release is live. The July research bundles remain unchanged, with their historical reproduction environment preserved separately.
- The canonical-capital repair was explicitly authorized and applied: 229 source-backed facts, 229 atomic history events, and 229 capital-cache values. A repeat proposes zero writes; all 253 directory rows match. Non-target data and source freshness are unchanged. A fresh isolated restore also survived the normal full cache refresh. Runtime/seed repair PR #30 is merged and deployed. See `plan/evidence/PLT-030/canonical-capital-repair-2026-09-17.json`.
- The selected engraved-globe sharing card and approved tagline from PR #27 are live. Main `5203cb7b` reached Ready with both canonical domains; HTTP, health, reader, Twitterbot metadata, and image-byte checks passed. Exact proof is in `plan/evidence/PLT-030/production-release-check-2026-09-17.json`. PR #28 records that completed release reconciliation.

The map is deferred at Fernando's direction. The master checklist is 266/312 complete with 46 remaining after closing EXP-038 and registering PLT-031; G4 remains blocked by the uncompleted checklist. Existing freshness and optional-classification health warnings remain disclosed. Do not interpret this task as a beta, academic-release, or external-review approval.

## Active reliability work

- PLT-031's cabinet configuration, three legislative adapters, bounded recovery, and durable alert transitions are merged in PR #35. PR #36 isolates two negative tests from the newly configured release identity. Both passed required CI/preview checks; production `e99cecd0` is Ready on the canonical domain.
- All four real deployed source dry runs passed with unchanged bill/cabinet fingerprints and source freshness, zero paid summary generation, and successful duplicate suppression. The new health/recovery path ran with zero eligible dispatches; reconciliation's one advisory warning now reports successful execution with `healthOk: false`. Evidence: `plan/evidence/PLT-031/production-verification-2026-09-17.json`.
- Keep PLT-031 open until the first ordinary scheduled applies are observed: September 18 cabinet 01:00 UTC, Canada 04:00, Germany 05:00, France 05:30. Old September 17 scheduled failures predate the repair; do not treat them as a failed post-fix run or fabricate a replacement slot. Codex owns the follow-up, including source freshness and terminal execution outcomes.
- Manual deployed checks should use the documented GET plus stable `Idempotency-Key`: empty POST requests were rejected before execution by the no-body guard. The pipeline monitor deliberately retains HTTP 503 for open findings with `pipeline_alert_*` outcomes; it excludes itself from alert inputs. Diagnose its reported sources, not that monitor record as another failed ingestion.
- Routine Dependabot version-update PRs are capped and cooled down; security updates retain their separate handling. Vercel pull-request comments were disabled at the project level, while commit-status checks and deployment events remain enabled. Vercel Deployment Failures emails were subsequently disabled at the personal team setting, and GitHub Actions failure notifications moved to on-GitHub-only; web alerts remain on, and billing/domain/security-related settings are unchanged.
- Read-only mailbox review distinguished cleanup-related messages from unresolved import failures. Private mailbox evidence stays outside Git.
- The owner chose Codex to investigate sync problems. An hourly local heartbeat now monitors this task and handles authorized routine repairs, with no email or public status-page messages. It requires the local host to be available; unchanged healthy or already-recovering states stay quiet.

## Reconciled decisions

- EXP-015 is complete: the 2026-08-17 owner decision rejected the image-led megamenu; the grouped Explore dropdown is canonical in `DESIGN.md`.
- EXP-038 is complete: the recorded A4/H5/T3 decisions are retained, T4 routes corrections to the shipped ATL-024 form, current disclosure v2 and the active September packet agree, and historical v1/July artifacts remain unchanged. Claims/build/browser evidence is under `plan/evidence/EXP-038/`.
- Amnesty permission was already chosen on 2026-08-18. PUL-040 stays open for a genuinely qualifying, newly evidenced observation start; never backdate the 90-day clock. No outreach or paid classifier transport is authorized here. The current task authorizes ordinary data-import repairs and operational automation.
- G4 and PLT-025 remain blocked by the remaining checklist. Successful release checks do not close unrelated manual, provider, research, or external-review work.

## Sources of truth

`plan/MASTER-CHECKLIST.md` and its area mirrors own current task status. `plan/MANUAL-CHECKS.md` identifies remaining manual work. `plan/PROGRESS.md`, Git, and task evidence retain historical shipped state; old handoff prose is not current production proof. Preserve the original checkout's untracked `plan/concept-mockups/` and unrelated local worktrees.
