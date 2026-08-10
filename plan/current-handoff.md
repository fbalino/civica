# Current handoff — Civica

**Updated:** 2026-08-10
**Current objective:** the owner-authorized Wikidata refresh wave
(ATL-010 / DAT-036 / EXP-029) is complete on branch
`claude/serene-wilbur-375a03`; the remaining authorized waves execute one at
a time under their own packets.

## Verified state

- Active branch for this work: `claude/serene-wilbur-375a03` (the production
  lineage; `codex/civica-academic-readiness` is 35 commits behind it and its
  checkout carries separate in-flight uncommitted work — do not discard or
  absorb either side). Plan is 259/310 complete.
- The 2026-08-09 owner authorization
  (`plan/evidence/QA-018/OWNER-SIGNOFF-2026-08-09.md`) covered four operator
  waves. Already executed earlier on this branch (2026-07-29): the Conditions
  production batch (ATL-026/ATL-027) and migrations 0046/0047 with the
  ATL-024 production preparation; production has been at migration head
  `0051_eminent_jocasta` since then, so migration 0048 was already live.
- This wave (2026-08-09/10) executed the named-release Wikidata refresh
  `atlas-wikidata-refresh-20260809-v1`:
  - **ATL-010 complete** — roster refreshed (197 states, 0 discrepancies,
    Samoa HoG a disclosed upstream-ambiguous exclusion), release
    `leaders-2026-08-10` ready, `/leaders` live in footer + sitemap, browser
    QA passed. Two defects fixed en route: Neon-HTTP parameter typing in the
    entity history writer, and a dissolved-state identity clobber (Russian
    Empire → Russia) with a dissolved-state SPARQL filter, a fail-closed
    identity guard, and a verified Q159 repair.
  - **DAT-036 complete** — 1,269/1,270 rows repaired append-only under the
    named release with public correction record
    `4ffdc3a2-012a-4256-ba0c-c4395aab7a4b` (resolved_corrected); one
    disclosed residual (Botswana GDP per capita, key no longer synced); the
    strict live release-quality gate passes all nine families.
  - **EXP-029 complete** — registered `atlas.entity-name-forms` pipeline
    wrote 1,184 source-backed forms; masthead and leaders-directory surfaces
    render labeled source forms; parties remain an explicit zero scope (no
    publisher identity exists).
- The G2 release was not rewritten; no new frozen vintage was cut.
- The Explore megamenu keeps its owner-approved eight art-backed items; a
  ninth ("World Leaders") needs owner-approved artwork if ever desired.

## Next actions

1. Rehearse QA-019 rollback/forward-fix in staging only (authorized,
   unexecuted).
2. Production deployment of this wave's code (release regeneration, /leaders
   activation, reader surfaces) follows the deployment runbook as a separate
   action; the database changes are already live.
3. When Fernando supplies a Pulse cost cap (or declines), record it and act
   accordingly; the Pulse wave (PUL-043/024/027 → PUL-040) remains
   unauthorized and untouched.
4. Denmark's jurisdiction QID (`Q756617`, Kingdom of Denmark) was reviewed
   and deliberately retained during the QID audit; flag to Fernando only if a
   Denmark-scoped data question arises.

## Boundaries

- One wave at a time; approvals do not combine; staging is not production
  authority except where the 2026-08-09 record explicitly grants production.
- Do not start the Pulse wave or any paid classifier run without written
  provider/model, volume, and hard-USD-cap authority.
- Do not expose credentials or private evidence in context files. Do not
  initialize BridgeMemory. Rewrite this handoff at the next milestone.
- The main checkout still holds an older untracked `plan/current-handoff.md`
  from 2026-08-09; this committed version supersedes it.
