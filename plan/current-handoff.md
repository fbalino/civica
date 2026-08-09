# Current handoff — Civica

**Updated:** 2026-08-09
**Current objective:** execute the four owner-authorized operator waves, one
at a time, each under its own packet, evidence, and validation gates.

## Verified state

- Active branch: `codex/civica-academic-readiness`. Plan is 253/310 complete.
- On 2026-08-09 Fernando recorded, in writing: (1) QA-018 confirmation of the
  attempt-06 isolated staging run (now checked, evidence
  `plan/evidence/QA-018/OWNER-SIGNOFF-2026-08-09.md`); (2) execution authority
  for the Conditions production batch (ATL-026/ATL-027), migrations 0046/0047
  (ATL-020/ATL-024), the named-release Wikidata refresh plus migration 0048
  (ATL-010/DAT-036/EXP-029), and the QA-019 staging rehearsal; (3) the GOV-012
  Option A no-honorarium posture (revisitable, recorded in the decision
  brief); and (4) exact subscription tiers, now in
  `data/program-cost-effort-ledger.v1.json` (validator passes).
- The Pulse wave (PUL-043/024/027 → PUL-040) is **not** authorized. Fernando
  asked for the plain-English commitment and cost before deciding; measured
  volume is 1–11 new clusters/day and a hard-USD-cap authorization was
  proposed to him. Raw-event ingestion shows no rows after 2026-07-29 —
  diagnose cron health as part of any Pulse setup.
- EXP-015: owner disposition "revise" recorded and the revisions are
  implemented in the working tree (headline removed, square full-bleed art,
  even register gutter, single quiet hover, @starting-style entrance).
  Owner re-review of the revised rendering is still open. EXP-038 A4 is
  approved and applied (`content/about.md` names Fernando); H5/T3/T4 remain
  held. Claims/docs and design-token gates pass on the working tree.
- The worktree contains these plus prior concurrent changes, uncommitted. Do
  not discard or absorb them into unrelated tranches.

## Next actions

1. Run the Conditions production batch under its packets (ATL-026, ATL-027;
   staging-verified ATL-016/029/030 records exist). Explicit owner production
   authority exists as of 2026-08-09.
2. Apply additive migrations 0046/0047 and complete ATL-020/ATL-024 stored
   history, receipt, triage, and delivery evidence.
3. Run the authorized Wikidata refresh plus migration 0048; complete
   ATL-010 (unpause `/leaders`), DAT-036, and EXP-029 verification.
4. Rehearse QA-019 rollback/forward-fix in staging only.
5. When Fernando supplies a Pulse cost cap (or declines), record it and act
   accordingly; the 90-day PUL-040 clock starts only after a full compliant
   cycle runs.

## Boundaries

- One wave at a time; do not combine approvals; staging is not production
  authority except where the 2026-08-09 record explicitly grants production.
- Do not start the Pulse wave or any paid classifier run without the owner's
  written provider/model, volume, and hard-USD-cap authority.
- Do not expose credentials or private evidence in context files. Do not
  initialize BridgeMemory. Rewrite this handoff at the next milestone.
