# Civica master checklist — remaining-work report

**Reviewed:** 2026-09-17

**Checklist state:** 264 of 311 complete; 47 remain; 84.9%.

## Bottom line

No: the remaining work is not only human review.

Thirteen tasks are direct owner, qualified-human, counsel/privacy, or research
participant work. Two require production, provider, or other external-system
authority. One requires unavailable publisher evidence and
external archive/source cooperation. No compliant calendar-bound observation
is currently running. Thirty are downstream tasks that cannot honestly start
until an earlier gate produces real evidence. One active release-stabilization
task must be evidenced before beta or release claims.

All currently safe, dependency-valid agent preparation is complete. There is
no checklist item that an agent can finish now without one of those new inputs
or authorities. This does not mean the agents are finished permanently:
decisions, production journeys, source refreshes, human studies, and the
prospective window will each re-enable implementation, analysis, remediation,
publication, or reporting work.

The machine-readable source is
`data/readiness/remaining-work.v1.json`. Its validator compares the six
categories with every unchecked master-checklist ID and fails on an omission,
duplicate, stale count, or newly agent-executable task.

The step-by-step owner handoff is
`plan/OWNER-ACTION-RUNBOOK-2026-07-25.md`. It names what Fernando can decide
directly, which professional or platform role is needed for every other
action, what evidence to request, when Codex can resume, and which contacts
must wait for G4 or G5.

## What needs action now

### 1. Direct human, owner, or professional review — 13

IDs: BRD-003, BRD-010, BRD-012, EXP-001, EXP-009, EXP-025, EXP-038,
GOV-012, IDX-022, IDX-034, PLT-029, QA-012, QA-013.

The prepared decisions and reviews are:

- the remaining EXP-038 correction-route reconciliation and reviewer
  compensation posture;
- qualified review of the rendered-module ledger, illustration candidates,
  visual baselines, screen-reader journeys, Index reader tasks, and
  constitution-to-practice coding;
- professional review of brand-confusion, illustration-rights, and privacy
  posture.

These are not interchangeable approvals. For example, approving EXP-009
candidates does not authorize replacing the production images, and approving
EXP-038 drafts does not authorize deployment or a new legal claim.

The image-led Explore candidate was superseded by Fernando's 2026-08-17
grouped-dropdown decision, so EXP-015 is complete. The immediately applicable
EXP-038 subset, including A4, H5, and T3, is implemented; its old T4 hold now
requires engineering reconciliation against the active ATL-024 correction route.
GOV-003 is complete:
all seven owner fields are confirmed, the canonical disclosure is published in
the source tree, and the current reviewer packets bind it unchanged. This does
not supply any remaining EXP-038 disposition or authorize deployment.

QA-018 is closed: Fernando's written confirmation of the isolated attempt-06
run is preserved with a date-correction note, and the exact-candidate
attempt-07 technical rehearsal through `0051_eminent_jocasta` is complete and
retained (`plan/evidence/QA-018/`).

### 2. Production, staging, or external-system authority — 2

IDs: PUL-024, PUL-040.

This batch includes:

- an explicit Pulse drift baseline followed by an eligible observation, and
  one complete scheduled locked-method cycle that can establish PUL-040's
  non-backdated start.

The 2026-07-29 production batch advanced the authoritative migration ledger
through `0051`, published and validated the named immutable Conditions release,
and closed ATL-026, ATL-027, PUL-027, and PUL-043. Those are completed
milestones, not instructions to rerun or re-authorize the same work. QA-019
closed on 2026-08-09 under Fernando's written rehearsal authority on the
retained protected bad-Preview → forward-fix run; its canonical record stays
fail-closed at `run_complete_pending_owner_signoff` until the owner creates
the external status record and records a dated disposition of the retained
evidence (`plan/evidence/QA-019/SIGNOFF-NOTE-2026-08-09.md`). ATL-020 and
ATL-024 closed on 2026-08-09 under the same written authority: migrations
`0046`/`0047` were confirmed applied at head `0051`, and a real reported and
corrected Atlas data error exercised the public change-history contract, the
durable receipt, authenticated triage, and correction linkage end to end
(`plan/evidence/ATL-020/`, `plan/evidence/ATL-024/`). ATL-010, DAT-036, and
EXP-029 closed on 2026-08-10 under the same authority through the named
`atlas-wikidata-refresh-20260809-v1` release.

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
downstream of PUL-040, which requires fresh proof of every frozen-method
prerequisite. Its eventual 90-day clock cannot be backdated to a code freeze,
a partial run, or the current date.

## What must wait

### 5. Downstream work blocked by an earlier gate — 30

IDs: ATL-028, BRD-005, BRD-016, EXP-016, EXP-028, GOV-015, GOV-016,
GOV-017, GOV-018, GOV-019, GOV-020, GOV-021, GOV-022, GOV-023, GOV-024,
GOV-025, GOV-026, GOV-027, GOV-028, PLT-025, PUL-018, PUL-019, PUL-020,
PUL-021, PUL-022, PUL-023, PUL-026, PUL-028, PUL-029, PUL-030.

The principal chains are:

1. The settled EXP-015 grouped-dropdown contract → EXP-016 reconciliation and
   closure → EXP-028 blind audit. The implementation must still carry current
   evidence through those later gates.
2. A production-authorized frozen longitudinal Conditions release → ATL-028
   construct study.
3. Pulse drift baseline + fresh frozen-method prerequisite evidence → PUL-040 start → PUL-026
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

### 6. Current release stabilization — 1

ID: PLT-030.

The runtime owners must first record dated reproduction, remediation or
containment, rollback posture, and replacement build, health, and reader-surface
evidence for the country-directory/data drift and critical dependency-audit
finding. This is current stabilization work, not a declaration that either
finding has a known cause or is fixed.

## Recommended order

1. Stabilize the current release under PLT-030 before beta or release claims.
2. Resolve the owner-review bundle: GOV-012, EXP-009, the remaining EXP-038
   reconciliation, EXP-025/QA-013, and PLT-029 facts.
3. Obtain the qualified/professional reviews: EXP-001, QA-012, IDX-022,
   IDX-034, BRD-003, BRD-010, and BRD-012.
4. Establish the explicit Pulse drift baseline, capture fresh frozen-method
   prerequisite evidence, complete one full scheduled cycle, record
   the non-backdated PUL-040 start, and allow PUL-026 to run for 90 days.
5. Create QA-019's external status record and record Fernando's retained-run
   disposition so its canonical rehearsal record can become `complete`.
6. Execute Pulse evaluation and disposition, regenerate the review packet,
   rerun G4, and only then authorize reviewer contact.
7. Complete G5, DOI/G6, and the post-review publication/outreach chain.

## Gate status

G4 remains blocked with 22 unchecked P0 tasks and 44 unchecked P0/P1 tasks.
GOV-003 adds no waiver, checklist/evidence gap, or master/mirror error. The
aggregate readiness artifact must be regenerated after all active lanes are
integrated. Successful local tests cannot convert missing human, external,
production, or elapsed-time outcomes into a pass.
