# Current handoff — Civica

**Updated:** 2026-09-17
**Current objective:** repository cleanup and release stabilization are complete. Await Fernando's review before resuming broader work; the map is deferred.

## Current release work

- Twenty-three obsolete remote branches were removed and eleven obsolete or deferred pull requests were closed. Deferred major toolchain upgrades were not merged; their links and exact heads remain in `plan/evidence/PLT-030/branch-cleanup-record-2026-09-17.json`.
- The critical dependency repair is merged in PR #29. All configured checks and its Vercel preview passed; the replacement September production release is live. The July research bundles remain unchanged, with their historical reproduction environment preserved separately.
- The canonical-capital repair was explicitly authorized and applied: 229 source-backed facts, 229 atomic history events, and 229 capital-cache values. A repeat proposes zero writes; all 253 directory rows match. Non-target data and source freshness are unchanged. A fresh isolated restore also survived the normal full cache refresh. Runtime/seed repair PR #30 is merged and deployed. See `plan/evidence/PLT-030/canonical-capital-repair-2026-09-17.json`.
- The selected engraved-globe sharing card and approved tagline from PR #27 are live. Main `5203cb7b` reached Ready with both canonical domains; HTTP, health, reader, Twitterbot metadata, and image-byte checks passed. Exact proof is in `plan/evidence/PLT-030/production-release-check-2026-09-17.json`. PR #28 records this reconciliation; its own documentation-only merge follows the normal checks.

The map is deferred at Fernando's direction. The master checklist is 265/311 complete with 46 remaining; G4 is blocked by 21 P0 and 43 P0/P1 tasks. Existing freshness and optional-classification health warnings remain disclosed. Do not interpret this task as a beta, academic-release, or external-review approval.

## Reconciled decisions

- EXP-015 is complete: the 2026-08-17 owner decision rejected the image-led megamenu; the grouped Explore dropdown is canonical in `DESIGN.md`.
- EXP-038 T4 is engineering reconciliation against the already-shipped ATL-024 correction flow, not another owner decision.
- Amnesty permission was already chosen on 2026-08-18. PUL-040 stays open for a genuinely qualifying, newly evidenced observation start; never backdate the 90-day clock. No outreach or paid classifier transport is authorized here.
- G4 and PLT-025 remain blocked by the remaining checklist. Successful release checks do not close unrelated manual, provider, research, or external-review work.

## Sources of truth

`plan/MASTER-CHECKLIST.md` and its area mirrors own current task status. `plan/MANUAL-CHECKS.md` identifies remaining manual work. `plan/PROGRESS.md`, Git, and task evidence retain historical shipped state; old handoff prose is not current production proof. Preserve the original checkout's untracked `plan/concept-mockups/` and unrelated local worktrees.
