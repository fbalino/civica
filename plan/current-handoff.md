# Current handoff — Civica

**Updated:** 2026-08-09 (post main-branch integration)
**Current objective:** main is the single working lineage; complete the
remaining owner-gated and dependency-blocked tasks from the master checklist.

## Verified state

- Active branch: `main`. The former `codex/civica-academic-readiness` working
  tree is fully merged; that branch is retired. Plan is 257/310 complete.
- Production Neon is at authoritative migration head `0051_eminent_jocasta`
  (applied 2026-07-29). The named immutable Conditions release
  `conditions-production-20260729-v1` is live and verified (ATL-026/ATL-027
  complete). PUL-027 and PUL-043 production closures, the PLT-007 credential
  rotation, and the 2026-07-29 production release smoke are recorded in
  `plan/PROGRESS.md`.
- QA-018 is complete: owner confirmation of the attempt-06 isolated run plus
  the passing exact-candidate attempt-07 packet through `0051`. Owner-session
  records created with a wrong 2026-08-09 date carry explicit date-correction
  notes (the sessions occurred in late July 2026).
- On 2026-08-09 Fernando directed, in writing, that all outstanding work be
  committed, merged to `main`, and deployed. That integration is this state.
- EXP-015: the owner-directed revisions (no headline, square full-bleed art,
  even register gutter, single quiet hover, `@starting-style` entrance) are
  merged; owner re-review of the rendered panel is still open.
- EXP-038: A4 About naming is approved and applied; T3 (response time) and
  T4 (correction route) remain the only held copy decisions.

## Next actions

1. ATL-020/ATL-024: complete the stored history journey, opaque correction
   receipt, authenticated triage, correction linkage, and delivery evidence
   against the live schema (migrations 0046/0047 are already active).
2. Run the authorized named-release Wikidata refresh; complete ATL-010
   (unpause `/leaders`), DAT-036, and EXP-029 verification (migration 0048 is
   already active).
3. QA-019: create one real non-notifying external status record and obtain
   Fernando's dated disposition of the rehearsal packet.
4. Obtain Fernando's re-review of the revised EXP-015 Explore panel and his
   T3/T4 copy decisions (EXP-038).
5. Pulse wave (PUL-043/024/027 → PUL-040 start): still requires the owner's
   written provider/model, volume, and hard-USD-cap authority. Raw-event
   ingestion showed no rows after 2026-07-29 — diagnose cron health as part
   of any Pulse setup.

## Boundaries

- One wave at a time; do not combine approvals. Written owner authority is
  required for paid classifier runs and any new production data batch.
- Do not expose credentials or private evidence in context files. Do not
  initialize BridgeMemory. Rewrite this handoff at the next milestone.
