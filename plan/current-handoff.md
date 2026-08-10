# Current handoff — Civica

**Updated:** 2026-08-10 (Wikidata refresh wave merged into the main lineage)
**Current objective:** main is the single working lineage; complete the
remaining owner-gated and dependency-blocked tasks from the master checklist.

## Verified state

- Active branch: `main`. The former `codex/civica-academic-readiness` working
  tree was fully merged on 2026-08-09 at Fernando's written instruction
  ("i want everything committed and on the main branch and live"); this
  update merges the completed Wikidata refresh wave from
  `claude/serene-wilbur-375a03` on top. Plan is 261/310 complete.
- Production Neon is at authoritative migration head `0051_eminent_jocasta`.
  The named Conditions release `conditions-production-20260729-v1` is live
  (ATL-026/ATL-027 complete); QA-018 and QA-019 are complete per the 2026-08-09
  accounting (owner-session records carry date-correction notes — the
  sessions occurred in late July 2026).
- The Wikidata refresh wave (2026-08-09/10, named release
  `atlas-wikidata-refresh-20260809-v1`) completed **ATL-010** (roster
  refreshed, release `leaders-2026-08-10` ready, `/leaders` live in footer +
  sitemap, Samoa HoG a disclosed upstream-ambiguous exclusion, Russia's
  jurisdiction QID repaired to Q159 with new dissolved-state and identity
  guards), **DAT-036** (1,269/1,270 facts repaired append-only under public
  correction record `4ffdc3a2-012a-4256-ba0c-c4395aab7a4b`; one disclosed
  residual; strict live release-quality gate green), and **EXP-029**
  (registered `atlas.entity-name-forms` pipeline wrote 1,184 source-backed
  forms; masthead and directory render labeled source forms; parties remain
  an explicit zero scope). The G2 release was untouched; no new frozen
  vintage was cut.
- EXP-015: the owner-directed Explore-panel revisions are merged; owner
  re-review of the rendered panel is still open. EXP-038: A4 and T3 are
  applied; T4 (correction route) is the only held copy decision.

## Next actions

1. Deploy the merged tree to production (the wave's database changes are
   already live; `/leaders`, the masthead name forms, and release artifacts
   go live with the deployment).
2. ATL-020/ATL-024: complete the stored history journey, opaque correction
   receipt, authenticated triage, correction linkage, and delivery evidence
   against the live schema (migrations 0046/0047 are active).
3. QA-019 residuals: the owner-created external status record and Fernando's
   dated disposition of the retained rehearsal run (itemized in
   `plan/evidence/QA-019/SIGNOFF-NOTE-2026-08-09.md`).
4. Obtain Fernando's re-review of the revised EXP-015 Explore panel and his
   T4 copy decision (EXP-038).
5. Pulse wave (PUL-043/024/027 → PUL-040 start): still requires the owner's
   written provider/model, volume, and hard-USD-cap authority. Raw-event
   ingestion showed no rows after 2026-07-29 — diagnose cron health as part
   of any Pulse setup.
6. Denmark's jurisdiction QID (`Q756617`, Kingdom of Denmark) was reviewed
   during the wave's QID audit and deliberately retained; revisit only if a
   Denmark-scoped data question arises.

## Boundaries

- One wave at a time; do not combine approvals. Written owner authority is
  required for paid classifier runs and any new production data batch.
- Do not expose credentials or private evidence in context files. Do not
  initialize BridgeMemory. Rewrite this handoff at the next milestone.
