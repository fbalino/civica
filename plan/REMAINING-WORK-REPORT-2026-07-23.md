# Civica master checklist — remaining-work report

**Reviewed:** 2026-07-26

**Checklist state:** 249 of 310 complete; 61 remain; 80.3%.

## Bottom line

No: the remaining work is not only human review.

Fourteen tasks are direct owner, qualified-human, counsel/privacy, or research
participant work. Sixteen require production, staging, provider, migration, or
source-refresh authority. One requires unavailable publisher evidence and
external archive/source cooperation. No compliant calendar-bound observation
is currently running. The other 30 are downstream tasks that cannot honestly
start until an earlier gate produces real evidence.

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

The step-by-step owner handoff is
`plan/OWNER-ACTION-RUNBOOK-2026-07-25.md`. It names what Fernando can decide
directly, which professional or platform role is needed for every other
action, what evidence to request, when Codex can resume, and which contacts
must wait for G4 or G5.

## What needs action now

### 1. Direct human, owner, or professional review — 14

IDs: BRD-003, BRD-010, BRD-012, EXP-001, EXP-009, EXP-015, EXP-025,
EXP-038, GOV-012, IDX-022, IDX-034, PLT-029, QA-012, QA-013.

The prepared decisions and reviews are:

- owner approval, revision, or rejection of the exact rendered Explore
  candidate, the four remaining English-copy dispositions (A4, H5, T3, and
  T4), and reviewer compensation posture;
- qualified review of the rendered-module ledger, illustration candidates,
  visual baselines, screen-reader journeys, Index reader tasks, and
  constitution-to-practice coding;
- professional review of brand-confusion, illustration-rights, and privacy
  posture.

These are not interchangeable approvals. For example, approving EXP-009
candidates does not authorize replacing the production images, and approving
EXP-038 drafts does not authorize deployment or a new legal claim.

The generated Explore light-master batch is approved and its rendered
implementation candidate is committed for review, but the exact desktop/mobile
light/dark result remains undecided. The immediately applicable EXP-038 subset
is implemented; A4, H5, T3, and T4 remain held. GOV-003 is complete: all seven
owner fields are confirmed, the canonical disclosure is published in the
source tree, and the current reviewer packets bind it unchanged. This does not
supply any remaining EXP-038 disposition or authorize deployment.

### 2. Production, staging, or external-system authority — 16

IDs: ATL-010, ATL-016, ATL-020, ATL-024, ATL-026, ATL-027, ATL-029,
ATL-030, DAT-036, EXP-029, PUL-024, PUL-027, PUL-040, PUL-043, QA-018,
QA-019.

This batch includes:

- enabling automated Neon Preview branching on the existing Vercel resource
  connection, then rerunning the fail-closed QA-018 isolation probe;
- isolated Conditions staging and release capture;
- Atlas entity-history and data-error migrations;
- a hardened Wikidata leaders refresh and a date-precision repair refresh;
- internationalized stored-name migration/source refresh;
- Pulse drift, decay/lifecycle, and private-workspace migrations;
- deployment of the locked Pulse method and one complete scheduled cycle;
- exact-commit release-candidate staging and the subsequent rollback or
  forward-fix rehearsal.

The checked plans are zero-write or pending-authority records. The 2026-07-26
Vercel CLI probe proved that Preview currently resolves to the production Neon
branch and therefore aborted before migration. None should be marked complete
from local fixtures alone.

### 3. Required external evidence unavailable — 1

ID: DAT-034.

The 300-row preregistered value-fidelity sample and every currently possible
official check are complete. The frozen sample still contains 171 CIA rows for
which the exact earlier publisher evidence is unavailable. Replacing those
rows or silently checking only the easier subset would invalidate the
preregistration.

### 4. Calendar-bound observation — 0

IDs: none.

No prospective Pulse shadow period is currently running. PUL-026 remains
downstream of PUL-040, which first requires authority-gated deployment and one
compliant scheduled cycle. Its eventual 90-day clock cannot be backdated to a
code freeze, a partial run, or the current date.

## What must wait

### 5. Downstream work blocked by an earlier gate — 30

IDs: ATL-028, BRD-005, BRD-016, EXP-016, EXP-028, GOV-015, GOV-016,
GOV-017, GOV-018, GOV-019, GOV-020, GOV-021, GOV-022, GOV-023, GOV-024,
GOV-025, GOV-026, GOV-027, GOV-028, PLT-025, PUL-018, PUL-019, PUL-020,
PUL-021, PUL-022, PUL-023, PUL-026, PUL-028, PUL-029, PUL-030.

The principal chains are:

1. EXP-015 rendered-result decision and canonization → EXP-016 reconciliation
   and closure → EXP-028 blind audit. The implementation candidate exists, but
   cannot bypass the owner decision.
2. Conditions staging/release → ATL-028 frozen longitudinal construct study.
3. Pulse migrations + v2.15 deployment/cycle → PUL-040 start → PUL-026
   90-day window → PUL-018–023 evaluation. Those results unlock the GOV-015
   Pulse review packet; the separate PUL-028/029 disposition → PUL-030 product
   release chain follows its own declared order.
4. Green G4/QA-020 + completed GOV-015 Pulse packet → GOV-016 →
   GOV-017–020 external review and G5.
5. G5 → GOV-021 DOI → GOV-022–028 notes, adoption assets, outreach,
   discoverability, staged launch, and use measurement.
6. BRD-003 counsel decision → conditional BRD-005 naming work; all legal
   outcomes → BRD-016 G6 memo.

Starting these early would either use the wrong design, analyze nonexistent
data, contact reviewers before authorization, draft against an unfrozen
release, or imply approvals that do not exist.

## Recommended order

1. Resolve the owner-review bundle: GOV-012, the exact EXP-015 rendered result,
   EXP-009, EXP-038 A4/H5/T3/T4, EXP-025/QA-013, and PLT-029 facts.
2. Obtain the qualified/professional reviews: EXP-001, QA-012, IDX-022,
   IDX-034, BRD-003, BRD-010, and BRD-012.
3. Enable Required Preview branching and Resource must be active before
   deployment for the Civica-to-Neon Vercel connection, then authorize one
   isolated staging wave covering QA-018 and the prepared Atlas, Conditions,
   internationalization, and Pulse migrations; keep production promotion
   separate.
4. Run the authorized Wikidata refreshes, deployed delivery checks, and
   QA-019 recovery rehearsal.
5. Deploy the locked Pulse method, complete one full scheduled cycle, record
   the non-backdated PUL-040 start, and allow PUL-026 to run for 90 days.
6. Execute Pulse evaluation and disposition, regenerate the review packet,
   rerun G4, and only then authorize reviewer contact.
7. Complete G5, DOI/G6, and the post-review publication/outreach chain.

## Gate status

G4 remains blocked with 27 unchecked P0 tasks and 57 unchecked P0/P1 tasks.
GOV-003 adds no waiver, checklist/evidence gap, or master/mirror error. The
aggregate readiness artifact must be regenerated after all active lanes are
integrated. Successful local tests cannot convert missing human, external,
production, or elapsed-time outcomes into a pass.
