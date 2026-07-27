# Civica remaining-work owner action runbook

**Reviewed:** 2026-07-26
**Scope:** the 61 unchecked tasks in `plan/MASTER-CHECKLIST.md`

## Open the review material

Every task below links to the prepared document, evidence folder, image, or
operator protocol that should be opened first. **No packet yet** means the task
is downstream and should not be started; it does not mean Fernando should
search the repository for an undocumented input.

Repository links open the source material directly in Codex or GitHub. Browser
paths show the current implementation, not an approval record. In the current
desktop session, Civica is running at `http://localhost:3002`; port 3000 is a
different project. If Civica restarts on another port, keep the path after the
port.

### EXP-015 — review the rendered large Explore candidate

Fernando rejected all three original concepts on 2026-07-25 because the menu
was too small and the directions did not provide the custom image-led
experience requested. That decision and the replacement brief are recorded in
the [concept study](EXP-014-explore-navigation-concepts-2026-07-18.md#owner-decision-for-exp-015),
the [replacement preparation record](evidence/EXP-015/PREPARATION.md), and the
[eight-image prompt specification](evidence/EXP-015/PROMPTS.md).

Fernando approved the complete corrected light-master batch on 2026-07-25.
Codex generated matching dark masters and built the near-page-width candidate.
The exact source hashes and limitations are in the
[light-master record](evidence/EXP-015/GENERATED-LIGHT-MASTERS.md) and
[dark-master record](evidence/EXP-015/GENERATED-DARK-MASTERS.md). The four
dated captures and verification boundary are in the
[rendered-candidate record](evidence/EXP-015/RENDERED-CANDIDATE.md).

To review the actual candidate, open the [local home page](http://localhost:3002/)
and activate `Explore` in the desktop header. Switch light/dark mode in the
header. For the mobile treatment, narrow the browser and open the hamburger
menu; the same eight destination identities appear in one reading order. The
always-open canonical component is also shown on the
[local design-system page](http://localhost:3002/design-system#explore-concepts).

The rejected alternatives remain only as historical evidence in these
committed captures:

| Concept | Desktop | Small mobile |
| --- | --- | --- |
| **The scholarly index** | [Light](evidence/EXP-014/mockups/2026-07-18-typography-first-scholarly-index-desktop-light.png) · [Dark](evidence/EXP-014/mockups/2026-07-18-typography-first-scholarly-index-desktop-dark.png) | [Light](evidence/EXP-014/mockups/2026-07-18-typography-first-scholarly-index-small-mobile-light.png) · [Dark](evidence/EXP-014/mockups/2026-07-18-typography-first-scholarly-index-small-mobile-dark.png) |
| **The civic cabinet** | [Light](evidence/EXP-014/mockups/2026-07-18-emblem-led-compact-menu-desktop-light.png) · [Dark](evidence/EXP-014/mockups/2026-07-18-emblem-led-compact-menu-desktop-dark.png) | [Light](evidence/EXP-014/mockups/2026-07-18-emblem-led-compact-menu-small-mobile-light.png) · [Dark](evidence/EXP-014/mockups/2026-07-18-emblem-led-compact-menu-small-mobile-dark.png) |
| **The reading room** | [Light](evidence/EXP-014/mockups/2026-07-18-editorial-mega-menu-desktop-light.png) · [Dark](evidence/EXP-014/mockups/2026-07-18-editorial-mega-menu-desktop-dark.png) | [Light](evidence/EXP-014/mockups/2026-07-18-editorial-mega-menu-small-mobile-light.png) · [Dark](evidence/EXP-014/mockups/2026-07-18-editorial-mega-menu-small-mobile-dark.png) |

No further selection among the old three or the approved light masters is
required. The current decision is to approve, revise, or reject the exact
rendered candidate after reviewing desktop/mobile and light/dark states.
Approval closes the visual gate but does not authorize deployment.

### EXP-038 — review the prepared English copy

Open the [itemized copy approval deck](EXP-038-english-copy-review-2026-07-23.md#proposed-edits).
It contains the current wording, proposed wording, reason, and
[2026-07-25 approval record](EXP-038-english-copy-review-2026-07-23.md#approval-record).
The unambiguous approved edits have been applied. A4 remains held while Fernando
decides whether and how the About narrative should name him; H5, T3, and T4
retain their separate factual or operating gates.

The website routes named in the deck show the **current** copy; they do not show
an unpublished alternate version. GOV-003 is now answered and published, so
H5 can be decided. Do not approve T3 unless a monitored response target is real,
or T4 until ATL-024 is active.
For context, browse the current [home](http://localhost:3002/),
[About](http://localhost:3002/about),
[Methodology](http://localhost:3002/methodology),
[Andorra Factbook](http://localhost:3002/country/andorra),
[Andorra data](http://localhost:3002/country/andorra/civica-data),
[Andorra Constitution](http://localhost:3002/country/andorra/constitution),
[Governance Evidence](http://localhost:3002/governance-evidence),
[Licensing](http://localhost:3002/licensing),
[Contact](http://localhost:3002/contact), and
[Advisory Board](http://localhost:3002/about/advisory-board) pages while
reading the corresponding item in the deck.

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

| Task | Open first | Fernando decides or supplies | What to return to Codex |
| --- | --- | --- | --- |
| EXP-015 | [Local rendered candidate](http://localhost:3002/), [design-system rendering](http://localhost:3002/design-system#explore-concepts), [dated captures and verification](evidence/EXP-015/RENDERED-CANDIDATE.md), [approved light masters](evidence/EXP-015/GENERATED-LIGHT-MASTERS.md), [dark masters](evidence/EXP-015/GENERATED-DARK-MASTERS.md), and [replacement preparation](evidence/EXP-015/PREPARATION.md) | Approve, revise, or reject the exact desktop/mobile and light/dark rendered result. | One rendered-candidate disposition and any specific revisions. Approval is not deployment authority. |
| EXP-038 | [Copy approval deck](EXP-038-english-copy-review-2026-07-23.md#approval-record) | Choose A4 naming and H5 now that GOV-003 is complete; choose T3 only if a real response posture exists, and T4 when the interim or live correction route is selected. | The four remaining dispositions. The approved subset is already applied; no translation or deployment is implied. |
| PLT-029 | [Telemetry procedure](PLT-029-program-cost-effort-telemetry-2026-07-23.md) and [current ledger](../data/program-cost-effort-ledger.v1.json) | Supply exact subscription tiers, actual invoices or paid-API spend, committed external-human spend, and reliable effort records if they exist. | Source-backed figures and periods. Unavailable effort remains `null`; Codex will not infer it. |

[GOV-012](research/reviewer-honorarium-decision-brief-v1.md#decision-requested)
also needs Fernando to choose a no-honorarium or compensation posture, ceiling,
payer/entity, currency, and jurisdiction and complete its
[approval record](research/reviewer-honorarium-decision-brief-v1.md#approval-record).
It is not complete until the accounting/tax role in Phase 2 confirms the
handling.

## Phase 2 — professional and qualified-human work

Contact people by role. This runbook does not nominate, approve, or claim to
have contacted anyone.

| Task | Role to contact | Send | Ask for and retain | Codex resumes with |
| --- | --- | --- | --- | --- |
| BRD-003 | Trademark/IP counsel | [Brand landscape](research/brand-confusion-landscape-2026-07-23.md), [official registry records](evidence/BRD-002/official-registry-records-2026-07-23.md), [keep/rename rubric](research/brand-keep-rename-decision-criteria-v1.md), [migration consequences](BRD-006-reversible-brand-domain-migration-plan-2026-07-23.md), plus launch geography, entity, services, posture, marks, domains, and estimated migration cost. | Written advice or a privileged decision summary covering registry, common-law, and confusion risk; owner disposition to keep, constrain, or rename. | Conditional BRD-005 naming work, then BRD-016 input. No namesake contact or filing is authorized here. |
| BRD-010 | IP/media counsel | [Counsel packet](evidence/BRD-010/README.md), [illustration rights policy](../data/EDITORIAL-ILLUSTRATION-RIGHTS.md), [policy audit](evidence/BRD-010/rights-policy-audit.v1.json), [illustration manifest](../src/lib/illustrations/illustration-manifest.generated.json), and [AI-use disclosure](../data/research/ai-use-disclosure-v1.json). | Written disposition on provider terms, copyrightability, references, landmarks, trademarks, likenesses, retention, and complaint handling. | Bounded policy or asset corrections. Candidate images are not cleared merely by this review. |
| BRD-012 | Privacy professional | [Review packet](evidence/BRD-012/README.md), [data-handling policy](../data/PRIVACY-DATA-HANDLING.md), [typed flow inventory](../src/lib/privacy/data-handling.ts), and the [aggregate live](evidence/BRD-012/privacy-live-audit.v1.json) and [browser](evidence/BRD-012/privacy-browser-check.v1.json) audits. Browse `/privacy` and the collection/error routes named in the packet for context. | Written decision on lawful basis, transfers, retention, subprocessors, user rights, and the proposed legacy-ID purge. | Policy/implementation reconciliation and, only if separately authorized, a zero-write-reviewed purge with aggregate before/after counts. |
| GOV-012 | Accounting/tax adviser | Fernando's completed [honorarium decision brief](research/reviewer-honorarium-decision-brief-v1.md), including posture, ceiling, payer/entity, currency, and jurisdictions. | Confirmation of payment, withholding, fees, currency, and institutional-payment handling. | Update of the reviewer packet and ledger only; reviewer outreach still waits for GOV-016. |
| EXP-001 | Qualified visual reviewer | [Review instructions](evidence/EXP-001/README.md), [rendered-module ledger](../data/rendered-module-ledger.v1.json), [evidence overlay](../data/rendered-module-evidence.v1.json), and the safe private fixtures named there. | A dated disposition for every required desktop/mobile × light/dark module cell, with screenshots and findings. | Repair of recorded findings and refreshed evidence. |
| EXP-009 | Qualified visual reviewer | [Candidate packet](evidence/EXP-009/README.md), [hash manifest](evidence/EXP-009/candidate-manifest.json), [prompts](evidence/EXP-009/PROMPTS.md), France [light](evidence/EXP-009/candidates/fra-candidate-light.webp)/[dark](evidence/EXP-009/candidates/fra-candidate-dark.webp), and United Kingdom [light](evidence/EXP-009/candidates/gbr-candidate-light.webp)/[dark](evidence/EXP-009/candidates/gbr-candidate-dark.webp). | Approve, reject, or revise each pair with hash, date, and reason. | A separate bounded replacement task if approved; approval alone does not publish an image. |
| EXP-025 and QA-013 | Qualified visual-baseline reviewer | [Promotion instructions](evidence/QA-013-EXP-025/README.md), [68-image candidate manifest](../e2e/visual-baselines/candidate-manifest.json), [coverage contract](../src/lib/qa/visual-regression-contract.ts), and the [candidate snapshot folder](../e2e/qa-013-visual-regression.spec.ts-snapshots/). | Explicit baseline promotion with reviewer, date, reason, and approved hashes. | Activation of enforceable visual diffs. Candidate baselines are not approvals. |
| QA-012 | Qualified screen-reader accessibility reviewer | [Manual review instructions](evidence/QA-012/README.md), [automated accessibility matrix](../e2e/qa-012-accessibility.spec.ts), and [keyboard journeys](../e2e/qa-012-keyboard.spec.ts). Review `/country/switzerland`, `/contact` validation, `/admin/sign-in?error=1`, and `/admin/pulse-coding/sign-in?error=1`. | Assistive technology/browser versions, keystrokes, spoken labels and announcements, findings, and dated disposition. | Accessibility fixes and bounded verification evidence. |
| IDX-034 | Blinded coders and a constitutional scholar | [Prepared evidence](evidence/IDX-034/README.md), [frozen coding codebook](research/k4-mapping-and-blind-coding-codebook-v1.md), [pairing release manifest](../data/releases/k4-constitution-practice-pairings-2024-v1/manifest.v1.json), and [practice-input manifest](../data/releases/ci-k4-practice-panel-2000-2024-v1/manifest.v1.json). | Blinded coding outputs and a documented fairness review against the preregistered thresholds. | Analysis of the coded results and a bounded nonaggregated disposition. |

[IDX-022 preparation](evidence/IDX-022/PREPARATION.md) and its
[reader-task preregistration](research/index-reader-task-preregistration-v1.md)
need at least 30 qualified research participants and explicitly wait for
qualified human testing at G5. Do not recruit those participants yet. The
protocol must stay frozen before recruitment. IDX-034 has no G5 dependency and
may proceed now with the qualified roles and frozen constraints listed above.

## Phase 3 — one isolated staging and external-authority wave

The platform operator may be Fernando if he controls the relevant accounts.
Otherwise use the person responsible for the Civica Vercel and Neon projects.
Production promotion remains a separate decision.

1. **[QA-018 first — wait for the new 0051 packet](evidence/QA-018/README.md).**
   Attempt 06 is valid historical evidence for the earlier candidate through
   migration `0050`; it does not prove the current `0051` candidate. Codex can
   run the newly authorized CLI-only isolated rehearsal and will prepare a new
   attempt-07 narrative and bounded machine record without changing persistent
   Preview settings or opening Neon in a browser. After that exact run passes,
   confirm or reject the new packet and record the date. Until then, do not
   sign off attempt 06 as the current QA-018 candidate.
2. **Conditions production batch — ATL-026 and ATL-027.** The isolated run
   completed the staging-verifiable ATL-016, ATL-029, and ATL-030 criteria.
   Production still needs explicit authority to apply the additive Conditions
   migrations and publish a named immutable release. Open the completed
   staging records for [ATL-016](ATL-016-conditions-comparison-2026-07-18.md),
   [ATL-026](ATL-026-conditions-components-2026-07-18.md),
   [ATL-027](ATL-027-conditions-release-freezing-2026-07-18.md),
   [ATL-029](ATL-029-versioned-conditions-public-read-2026-07-18.md), and
   [ATL-030](ATL-030-conditions-codebook-replication-2026-07-18.md). If you
   authorize production, state that explicitly; the staging run itself does
   not grant that authority.
3. **Atlas history and corrections — ATL-020 and ATL-024.** Apply additive
   migrations 0046 and 0047 through the approved flow, then retain the stored
   history journey, opaque correction receipt, authenticated triage,
   correction linkage, and delivery evidence. Start with the
   [ATL-020 plan](ATL-020-atlas-change-history-2026-07-22.md),
   [ATL-020 evidence](evidence/ATL-020/README.md), and
   [ATL-024 staging packet](evidence/ATL-024/README.md). The relevant routes
   are `/api/citations/[entityType]/[id]/history`, `/report-data-issue`,
   `/admin/corrections`, and `/admin/corrections/[id]`; several intentionally
   fail closed until the staging schema exists.
4. **Source refreshes — ATL-010, DAT-036, EXP-029.** Authorize named-release
   Wikidata refreshes and migration 0048 where required. Retain input release,
   adapter/version, row counts, discrepancy report, representative stored
   forms, and browser review. Never rewrite the immutable G2 release. Use the
   [ATL-010 refresh plan](ATL-010-world-leaders-directory-readiness-2026-07-18.md)
   and [browser checklist](evidence/ATL-010/browser-verification.md), the
   [DAT-036 repair runbook](evidence/DAT-036/repair-runbook.md), and the
   [EXP-029 internationalization plan](EXP-029-internationalization-readiness-2026-07-18.md).
   `/leaders` remains publication-paused until the refresh; `/about#language`
   is the EXP-029 reader surface.
5. **Pulse setup — PUL-043, PUL-024, PUL-027, then PUL-040.** Apply and
   reconcile the prepared additive migrations, deploy the exact locked
   `pulse-v2.15-beta` method, and permit one complete scheduled
   ingest → cluster → classify → corroborate/score cycle. Only then may Codex
   calculate and record the first compliant, non-backdated PUL-040 start.
   Any paid manual classifier run needs separate written provider/model,
   maximum-volume, and hard-USD-cap authority. Open the
   [PUL-043 migration packet](evidence/PUL-043/README.md),
   [PUL-024 drift plan](PUL-024-drift-monitoring-2026-07-18.md),
   [PUL-027 lifecycle plan](PUL-027-decay-window-lifecycle-2026-07-18.md), and
   [PUL-040 start-readiness packet](evidence/PUL-040/README.md). Operating
   evidence appears at `/api/v1/pulse/source-coverage` and
   `/api/v1/pulse/cluster-coverage`; neither route proves the 90-day clock has
   started.
6. **[QA-019 last — rehearse recovery](evidence/QA-019/README.md).** In staging
   only, follow the [rollback/forward-fix rehearsal](../data/ROLLBACK-FORWARD-FIX-REHEARSAL.md),
   release the prepared deliberately bad candidate, demonstrate detection and
   containment, then rollback or forward-fix it. Retain cache, artifact,
   version, status, and correction evidence plus the dated sign-off.

The remaining authority/sign-off task set is ATL-010, ATL-020, ATL-024,
ATL-026, ATL-027, DAT-036, EXP-029, PUL-024, PUL-027, PUL-040, PUL-043,
QA-018, and QA-019.

## Phase 4 — blockers that cannot be simulated

- **[DAT-034](evidence/DAT-034/README.md):** follow the
  [value-fidelity protocol](research/dat-034-value-fidelity-protocol-v1.md) and
  obtain the exact retained CIA publisher bytes, or equivalent official
  evidence, for the 171 frozen-sample rows. Do not substitute easier rows or
  publish a full-sample error estimate from the available subset.
- **PUL-026:** read the
  [prospective validation protocol](research/pulse-validation-protocol-v1.md)
  and [start boundary](evidence/PUL-025/start-boundary.md). After PUL-040
  records the valid start, preserve locked outputs for 90 consecutive UTC days
  before labels are opened or evaluation begins. The period cannot be
  backdated. **No PUL-026 result packet exists yet because the observation has
  not started.**

## Phase 5 — work that starts only after its gate

1. The [EXP-015 replacement](evidence/EXP-015/PREPARATION.md) must be
   generated, rendered, and owner-approved before it unlocks EXP-016;
   completed fixes, promoted baselines, and the module review then unlock
   EXP-028. **No standalone EXP-016 or EXP-028 packet exists yet; Codex creates
   those bounded work records only after the decisions above.**
2. A real frozen Conditions staging/release unlocks
   [ATL-028](ATL-028-economic-stability-construct-2026-07-18.md); its current
   [evidence note](evidence/ATL-028/README.md) prohibits publishing an economic
   composite before that gate.
3. Pulse setup and PUL-040 unlock PUL-026; after the full 90 days, Codex can
   execute PUL-018 through PUL-023 under the
   [sampling preregistration](research/pulse-evaluation-sampling-preregistration-v1.md),
   [independent-coding codebook](research/pulse-independent-coding-codebook-v1.md),
   and [validation protocol](research/pulse-validation-protocol-v1.md). Those
   prospective results create GOV-015, the Pulse review packet. **PUL-018–023
   and GOV-015 have protocols but no result packet yet.** The separate
   PUL-028, PUL-029, and PUL-030 evaluation, disposition, and release chain is
   controlled by the [Pulse checklist](05-pulse-event-ledger-and-validation.md)
   and likewise has no standalone result packet yet.
4. [PLT-025](PLT-025-g4-operations-readiness-2026-07-23.md) can close only
   after the unwaived P0/P1 operational blockers close; the current
   [operations report](../data/OPERATIONS-READINESS.md) remains blocked.
   GOV-016 requires both a green G4/[QA-020 report](evidence/QA-020/README.md)
   and the completed GOV-015 Pulse packet.
5. Only after GOV-016 may Fernando approve reviewer identities, conflicts,
   compensation, and outreach order. The prepared inputs are the
   [selection criteria](research/reviewer-selection-criteria-v1.md),
   [longlist](research/reviewer-longlist-v1.md),
   [ranking](research/reviewer-ranking-v1.md), and
   [honorarium brief](research/reviewer-honorarium-decision-brief-v1.md). The
   roles are an independent governance-measurement reviewer, a political
   event-data reviewer, a research-data librarian or curator, and an
   accessibility reviewer. GOV-017 through GOV-020 capture reports, author
   responses, revisions, and the G5 decision; they deliberately have no
   standalone packet before outreach is authorized.
6. Only after G5 may GOV-021 deposit the DOI. GOV-022 through GOV-028 then
   cover reproducible notes, teaching assets, approved outreach,
   discoverability, staged launch, and use measurement. Their controlling
   definitions are in the
   [governance/outreach checklist](10-academic-governance-review-and-outreach.md);
   no post-G5 packets exist yet.
7. The BRD-003 counsel decision above determines whether BRD-005 is needed.
   Use the [keep/rename rubric](research/brand-keep-rename-decision-criteria-v1.md)
   and [reversible migration plan](BRD-006-reversible-brand-domain-migration-plan-2026-07-23.md)
   if it is. BRD-016 is the final G6 legal/privacy/rights memo and has no packet
   until the underlying reviews are complete.

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
