# Civica master checklist — remaining-work report

**Reviewed:** 2026-07-23

**Checklist state:** 245 of 307 complete; 62 remain; 79.8%.

## Bottom line

No: the remaining work is not only human review.

Fifteen tasks are direct owner, qualified-human, counsel/privacy, or research
participant work. Sixteen require production, staging, provider, migration, or
source-refresh authority. One is blocked by unavailable publisher evidence.
One is a 90-day calendar-bound observation. The other 29 are downstream tasks
that cannot honestly start until an earlier gate produces real evidence.

All currently safe, dependency-valid agent preparation is complete. There is
no checklist item that an agent can finish now without one of those new inputs
or authorities. This does not mean the agents are finished permanently:
decisions, staging runs, source refreshes, human studies, and the prospective
window will each re-enable implementation, analysis, remediation, publication,
or reporting work.

The machine-readable source is
`data/readiness/remaining-work.v1.json`. Its validator compares the five
categories with every unchecked master-checklist ID and fails on an omission,
duplicate, stale count, or newly agent-executable task.

## What needs action now

### 1. Direct human, owner, or professional review — 15

IDs: BRD-003, BRD-010, BRD-012, EXP-001, EXP-009, EXP-015, EXP-025,
EXP-038, GOV-003, GOV-012, IDX-022, IDX-034, PLT-029, QA-012, QA-013.

The prepared decisions and reviews are:

- owner facts for funding/conflicts/editorial control and actual
  subscription/spend;
- owner selection of the Explore direction, English copy, and reviewer
  compensation posture;
- qualified review of the rendered-module ledger, illustration candidates,
  visual baselines, screen-reader journeys, Index reader tasks, and
  constitution-to-practice coding;
- professional review of brand-confusion, illustration-rights, and privacy
  posture.

These are not interchangeable approvals. For example, approving EXP-009
candidates does not authorize replacing the production images, and approving
EXP-038 drafts does not authorize deployment or a new legal claim.

### 2. Production, staging, or external-system authority — 16

IDs: ATL-010, ATL-016, ATL-020, ATL-024, ATL-026, ATL-027, ATL-029,
ATL-030, DAT-036, EXP-029, PUL-024, PUL-027, PUL-040, PUL-043, QA-018,
QA-019.

This batch includes:

- isolated Conditions staging and release capture;
- Atlas entity-history and data-error migrations;
- a hardened Wikidata leaders refresh and a date-precision repair refresh;
- internationalized stored-name migration/source refresh;
- Pulse drift, decay/lifecycle, and private-workspace migrations;
- deployment of the locked Pulse method and one complete scheduled cycle;
- exact-commit release-candidate staging and the subsequent rollback or
  forward-fix rehearsal.

The checked plans are zero-write or pending-authority records. None should be
marked complete from local fixtures alone.

### 3. Required external evidence unavailable — 1

ID: DAT-034.

The 300-row preregistered value-fidelity sample and every currently possible
official check are complete. The frozen sample still contains 171 CIA rows for
which the exact earlier publisher evidence is unavailable. Replacing those
rows or silently checking only the easier subset would invalidate the
preregistration.

### 4. Calendar-bound observation — 1

ID: PUL-026.

The prospective Pulse shadow period must run for 90 consecutive UTC days after
PUL-040 records a compliant start. The clock has not started. It cannot be
backdated to a code freeze, a partial run, or the current date.

## What must wait

### 5. Downstream work blocked by an earlier gate — 29

IDs: ATL-028, BRD-005, BRD-016, EXP-016, EXP-028, GOV-015, GOV-016,
GOV-017, GOV-018, GOV-019, GOV-020, GOV-021, GOV-022, GOV-023, GOV-024,
GOV-025, GOV-026, GOV-027, GOV-028, PLT-025, PUL-018, PUL-019, PUL-020,
PUL-021, PUL-022, PUL-023, PUL-028, PUL-029, PUL-030.

The principal chains are:

1. EXP-015 owner selection → EXP-016 implementation → EXP-028 blind audit.
2. Conditions staging/release → ATL-028 frozen longitudinal construct study.
3. Pulse migrations + v2.15 deployment/cycle → PUL-040 start → PUL-026
   90-day window → PUL-018–023 evaluation → PUL-028/029 disposition →
   PUL-030 product release.
4. Green G4/PLT-025 + completed Pulse packet → GOV-015/016 →
   GOV-017–020 external review and G5.
5. G5 → GOV-021 DOI → GOV-022–028 notes, adoption assets, outreach,
   discoverability, staged launch, and use measurement.
6. BRD-003 counsel decision → conditional BRD-005 naming work; all legal
   outcomes → BRD-016 G6 memo.

Starting these early would either use the wrong design, analyze nonexistent
data, contact reviewers before authorization, draft against an unfrozen
release, or imply approvals that do not exist.

## Recommended order

1. Resolve the owner-review bundle: GOV-003, GOV-012, EXP-015, EXP-009,
   EXP-038, EXP-025/QA-013, and PLT-029 facts.
2. Obtain the qualified/professional reviews: EXP-001, QA-012, IDX-022,
   IDX-034, BRD-003, BRD-010, and BRD-012.
3. Authorize one isolated staging wave covering QA-018 and the prepared Atlas,
   Conditions, internationalization, and Pulse migrations; keep production
   promotion separate.
4. Run the authorized Wikidata refreshes, deployed delivery checks, and
   QA-019 recovery rehearsal.
5. Deploy the locked Pulse method, complete one full scheduled cycle, record
   the non-backdated PUL-040 start, and allow PUL-026 to run for 90 days.
6. Execute Pulse evaluation and disposition, regenerate the review packet,
   rerun G4, and only then authorize reviewer contact.
7. Complete G5, DOI/G6, and the post-review publication/outreach chain.

## Gate status

G4 remains blocked with 27 unchecked P0 tasks and 58 unchecked P0/P1 tasks.
There are zero waivers, zero checklist/evidence gaps, and zero master/mirror
errors in the freshly regenerated readiness artifact. Successful local tests
cannot convert those missing human, external, production, or elapsed-time
outcomes into a pass.
