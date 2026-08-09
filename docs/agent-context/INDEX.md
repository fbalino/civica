# Civica agent context index

**Last verified:** 2026-07-16

Read the root `AGENTS.md` before working in this repository.

## Authority and routing

| Need | Authoritative source | Notes |
|---|---|---|
| Academic-readiness scope and task status | `plan/MASTER-CHECKLIST.md` | Primary execution authority. A checked item without its required evidence and matching progress entry is invalid. |
| Mission, gates, and dependency order | `plan/00-mission-and-operating-rules.md` | Follow gate order rather than simple document order. |
| Completed-task evidence | `plan/evidence/<ID>/` | Inspect the exact task folder; absence is an open gate. |
| Completion record | `plan/PROGRESS.md` | Historical completion ledger, not a substitute for evidence. |
| Current working state | `plan/current-handoff.md` | Short routing surface; subordinate to the checklist and evidence. |
| Active PLT-017 implementation plan | `plan/PLT-017-source-job-observability-2026-07-15.md` | Working plan only; PLT-017 remains incomplete until every written gate passes. |
| Durable project decisions | `plan/DECISIONS.md` | Search by task or decision ID; do not preload the full historical file. |
| Product and design rules | `AGENTS.md`, `DESIGN.md` | Project invariants and visual system. |
| Implementation history | Git and current code | Preserve the dirty worktree and verify current behavior. |

## Legacy memory status

The four files under `.claude/rules/memory-*.md` are legacy discovery material, not authority. They are still auto-loaded pending a dedicated, security-reviewed migration after the active PLT-017 tranche settles. Do not append session history or new decisions to them.

## Sensitivity

Do not copy credentials, environment values, production data, retained research evidence, private coding-workspace content, or customer/personal data into context files. Point to the protected source and record only the minimum non-secret state needed for routing.
