# Civica remaining-work owner action runbook

**Reviewed:** 2026-07-25
**Scope:** the 62 unchecked tasks in `plan/MASTER-CHECKLIST.md`

## How to use this runbook

Work the five phases below in order. Fernando supplies decisions and
authorities; qualified people supply judgments that an agent cannot; platform
operators produce real staging or provider evidence; Codex resumes the
implementation, analysis, reconciliation, and documentation after each named
input exists.

Do not combine distinct approvals. A visual approval is not production
authority. A staging run is not production promotion. A successful local test
is not external review. Unknown cost or effort stays unknown rather than being
estimated.

## Phase 1 — decisions Fernando can make now

These require no external contact before a decision is recorded.

| Task | Fernando decides or supplies | What to return to Codex |
| --- | --- | --- |
| EXP-015 | Select one of the three prepared Explore navigation concepts, or reject all three with a reason. | Selected concept and a short dated rationale. Codex can then canonize and implement EXP-016. |
| EXP-038 | Approve, revise, or reject each prepared English copy item. Confirm factual predicates such as the independence label, correction call to action, and any monitored response target. | Item-by-item disposition plus corrected facts. Codex can apply only approved wording. |
| GOV-003 | Supply the seven prepared funding, conflict, sponsorship, political-independence, source-provider, tool-support, and editorial-control facts. | Completed fact sheet and permission to publish or a list of facts to withhold. Codex can make public and reviewer disclosures match. |
| PLT-029 | Supply exact subscription tiers, actual invoices or paid-API spend, committed external-human spend, and reliable effort records if they exist. | Source-backed figures and periods. Unavailable effort remains `null`; Codex will not infer it. |

GOV-012 also needs Fernando to choose a no-honorarium or compensation posture,
ceiling, payer/entity, currency, and jurisdiction, but it is not complete until
the accounting/tax role in Phase 2 confirms the handling.

## Phase 2 — professional and qualified-human work

Contact people by role. This runbook does not nominate, approve, or claim to
have contacted anyone.

| Task | Role to contact | Send | Ask for and retain | Codex resumes with |
| --- | --- | --- | --- | --- |
| BRD-003 | Trademark/IP counsel | Launch geography, entity, services, intended posture, marks, domains, and estimated migration cost. | Written advice or a privileged decision summary covering registry, common-law, and confusion risk; owner disposition to keep, constrain, or rename. | Conditional BRD-005 naming work, then BRD-016 input. No namesake contact or filing is authorized here. |
| BRD-010 | IP/media counsel | Image-provider terms, current illustration policy, manifests, disclosures, retention, and complaint process. | Written disposition on provider terms, copyrightability, references, landmarks, trademarks, likenesses, retention, and complaint handling. | Bounded policy or asset corrections. Candidate images are not cleared merely by this review. |
| BRD-012 | Privacy professional | Data-flow inventory, providers/subprocessors, retention rules, rights handling, operator and intended jurisdictions. | Written decision on lawful basis, transfers, retention, subprocessors, user rights, and the proposed legacy-ID purge. | Policy/implementation reconciliation and, only if separately authorized, a zero-write-reviewed purge with aggregate before/after counts. |
| GOV-012 | Accounting/tax adviser | Fernando's proposed compensation posture, ceiling, payer/entity, currency, and jurisdictions. | Confirmation of payment, withholding, fees, currency, and institutional-payment handling. | Update of the reviewer packet and ledger only; reviewer outreach still waits for GOV-016. |
| EXP-001 | Qualified visual reviewer | Rendered-module ledger and safe review fixtures. | A dated disposition for every required desktop/mobile × light/dark module cell, with screenshots and findings. | Repair of recorded findings and refreshed evidence. |
| EXP-009 | Qualified visual reviewer | The four hash-pinned France/UK illustration candidates and reference contract. | Approve, reject, or revise each pair with hash, date, and reason. | A separate bounded replacement task if approved; approval alone does not publish an image. |
| EXP-025 and QA-013 | Qualified visual-baseline reviewer | The 68-image candidate manifest and visual-regression instructions. | Explicit baseline promotion with reviewer, date, reason, and approved hashes. | Activation of enforceable visual diffs. Candidate baselines are not approvals. |
| QA-012 | Qualified screen-reader accessibility reviewer | Country route, contact validation, and both sign-in error journeys. | Assistive technology/browser versions, keystrokes, spoken labels and announcements, findings, and dated disposition. | Accessibility fixes and bounded verification evidence. |
| IDX-034 | Blinded coders and a constitutional scholar | The frozen mapping codebook, small justified pairing set, source text, practice indicators, uncertainty rules, and no-gap/no-rank constraint. | Blinded coding outputs and a documented fairness review against the preregistered thresholds. | Analysis of the coded results and a bounded nonaggregated disposition. |

IDX-022 needs at least 30 qualified research participants and explicitly waits
for qualified human testing at G5. Do not recruit those participants yet. Its
prepared protocol must stay frozen before recruitment. IDX-034 has no G5
dependency and may proceed now with the qualified roles and frozen constraints
listed above.

## Phase 3 — one isolated staging and external-authority wave

The platform operator may be Fernando if he controls the relevant accounts.
Otherwise use the person responsible for the Civica Vercel and Neon projects.
Production promotion remains a separate decision.

1. **QA-018 first — create the release-candidate staging environment.** Use an
   isolated Neon branch and Vercel staging project, disable staging cron,
   deploy the exact candidate commit, apply only the approved migrations and
   inputs, and retain the twelve named smoke-check results.
2. **Conditions batch — ATL-016, ATL-026, ATL-027, ATL-029, ATL-030.** Apply
   migrations 0040 and 0042 in isolated staging, ingest a real immutable
   Conditions release, and retain aligned, mixed-year-refused, and missing-row
   evidence. Codex can then reconcile browser, API, export, and replication
   outputs. This does not authorize production.
3. **Atlas history and corrections — ATL-020 and ATL-024.** Apply additive
   migrations 0046 and 0047 through the approved flow, then retain the stored
   history journey, opaque correction receipt, authenticated triage,
   correction linkage, and delivery evidence.
4. **Source refreshes — ATL-010, DAT-036, EXP-029.** Authorize named-release
   Wikidata refreshes and migration 0048 where required. Retain input release,
   adapter/version, row counts, discrepancy report, representative stored
   forms, and browser review. Never rewrite the immutable G2 release.
5. **Pulse setup — PUL-043, PUL-024, PUL-027, then PUL-040.** Apply and
   reconcile the prepared additive migrations, deploy the exact locked
   `pulse-v2.15-beta` method, and permit one complete scheduled
   ingest → cluster → classify → corroborate/score cycle. Only then may Codex
   calculate and record the first compliant, non-backdated PUL-040 start.
   Any paid manual classifier run needs separate written provider/model,
   maximum-volume, and hard-USD-cap authority.
6. **QA-019 last — rehearse recovery.** In staging only, release the prepared
   deliberately bad candidate, demonstrate detection and containment, then
   rollback or forward-fix it. Retain cache, artifact, version, status, and
   correction evidence plus the dated sign-off.

The authority-gated task set is ATL-010, ATL-016, ATL-020, ATL-024, ATL-026,
ATL-027, ATL-029, ATL-030, DAT-036, EXP-029, PUL-024, PUL-027, PUL-040,
PUL-043, QA-018, and QA-019.

## Phase 4 — blockers that cannot be simulated

- **DAT-034:** obtain the exact retained CIA publisher bytes, or equivalent
  official evidence, for the 171 frozen-sample rows. Do not substitute easier
  rows or publish a full-sample error estimate from the available subset.
- **PUL-026:** after PUL-040 records the valid start, preserve locked outputs
  for 90 consecutive UTC days before labels are opened or evaluation begins.
  The period cannot be backdated.

## Phase 5 — work that starts only after its gate

1. EXP-015 unlocks EXP-016; completed fixes, promoted baselines, and the
   module review then unlock EXP-028.
2. A real frozen Conditions staging/release unlocks ATL-028.
3. Pulse setup and PUL-040 unlock PUL-026; after the full 90 days, Codex can
   execute PUL-018 through PUL-023. Those prospective results unlock GOV-015,
   the Pulse review packet. The separate PUL-028, PUL-029, and PUL-030
   evaluation, disposition, and release chain still follows its own declared
   order.
4. PLT-025 can close only after the unwaived P0/P1 operational blockers close.
   GOV-016 requires both a green G4/QA-020 report and the completed GOV-015
   Pulse packet.
5. Only after GOV-016 may Fernando approve reviewer identities, conflicts,
   compensation, and outreach order. The roles are an independent governance
   measurement reviewer, a political event-data reviewer, a research-data
   librarian or curator, and an accessibility reviewer. GOV-017 through
   GOV-020 capture reports, author responses, revisions, and the G5 decision.
6. Only after G5 may GOV-021 deposit the DOI. GOV-022 through GOV-028 then
   cover reproducible notes, teaching assets, approved outreach,
   discoverability, staged launch, and use measurement.
7. BRD-003 determines whether BRD-005 is needed. BRD-016 remains the final G6
   legal/privacy/rights memo.

No external-review solicitation, DOI claim, outreach, deployment, paid
activity, approval, or elapsed observation is recorded by this runbook.

## Evidence hand-back

For an owner decision, return the dated decision and its rationale. For a
professional review, retain the role, scope, date, conflicts, disposition, and
an appropriately shareable written summary. For staging or provider work,
retain the exact commit/release/method identifiers, environment, commands or
operator steps, timestamps, bounded outputs, and failures. Do not send
credentials, raw private data, privileged advice, or restricted publisher
bytes into chat or Git; provide a safe summary and hashes or access
instructions instead.

After any one input arrives, Codex should reopen only the task chain it
unlocks, update its evidence, rerun the relevant gates, and regenerate the
remaining-work and G4 reports.
