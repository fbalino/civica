# Fable 5 workflow review — PUL-017

You are a bounded, read-only design and research-workflow reviewer. Do not edit files, do not delegate, and do not implement.

Project root: `/Users/fernandobalino/Projects/civica`

Objective: recommend the information architecture and interaction contract for PUL-017, an access-controlled double-coding and adjudication tool for the Pulse country-day evaluation set.

Read first:

- `AGENTS.md` if present and the project instructions supplied by Claude Code
- `DESIGN.md`
- `plan/05-pulse-event-ledger-and-validation.md` (PUL-017)
- `plan/research/pulse-independent-coding-codebook-v1.md`
- `plan/evidence/PUL-016/README.md`
- `src/lib/pulse/v2/coder-protocol.ts`
- the existing admin shell and Pulse review routes under `src/app/(admin)` and `src/app/api/admin`
- `src/app/admin.css`
- `src/lib/admin/session.ts`

Constraints:

- The existing `/admin/pulse-review` is owner-only production review and exposes model output; independent coding must not leak production/model/peer/adjudication labels.
- Two independent coders must not see one another's labels before both lock.
- Adjudication is a separate role/workspace and preserves both immutable submissions.
- Evidence snapshots and codebook/method versions must remain visible.
- All decisions must be exportable and auditable.
- The tool must follow Civica's existing design system and should feel scholarly, calm, and task-focused rather than like a generic SaaS dashboard.
- Human coding is later; the current implementation must be testable without claiming that agent pilots are gold.

Answer these questions:

1. Should this extend `/admin/pulse-review` or be a distinct `/admin/pulse-coding` workspace, and why?
2. What are the minimum list, coding, locked/waiting, comparison, adjudication, and export views?
3. What information must be deliberately hidden at each role/stage?
4. What is the best single-page coding layout and hierarchy, using existing Civica components/tokens?
5. What workflow/state errors are most dangerous, and what interface safeguards should prevent them?
6. Give an implementation-ready recommendation, including route map, navigation labels, status vocabulary, and a concise acceptance checklist.

Return a concise structured report. Distinguish non-negotiable workflow safeguards from optional polish. No marketing prose.
