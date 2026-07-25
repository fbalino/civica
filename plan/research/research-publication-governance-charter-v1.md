# Civica research and publication governance charter v1

Contract: `civica-research-publication-governance/v1`

Effective: 2026-07-11

Status: operative internal charter; public disclosure work follows in GOV-002–GOV-005

## Accountable human

**Fernando Baliño**, founder and publisher, is currently the named human responsible for Civica Atlas's research and publication decisions.

Civica currently has one accountable human. That concentration is a limitation. Automated gates, immutable records, and independent external criticism provide checks, but they do not create an internal separation of duties or turn a one-person project into an editorial board.

No responsibility is assigned to an unnamed group. A future delegate must be named in a versioned appointment that states the scope, start date, end or review date, and recusal route.

## Authority boundary

Agents and models have no decision rights. They may research, draft, implement, test, audit, and recommend. They may not claim authorship, approve or publish research, waive conflicts, select or contact reviewers, authorize spending, accept risk, or restore an emergency-suspended surface. A passing validator supplies evidence to Fernando; it does not make the decision.

Frozen gates may not be waived silently. Any exception must identify the evidence, risk, duration, affected claim, and correction or rollback path in a versioned record.

## Decision rights

Fernando is accountable for every domain below. Consultation, automated verification, or outside advice does not transfer the final human responsibility.

| Domain | Decision right | Required record | Blocking condition |
|---|---|---|---|
| `data` | Approve sources, reconciliation, derivations, quality disposition, and frozen-release inclusion | Source/input manifests, provenance and validation, rights state, release-linked decision | Unknown provenance, failed integrity, material unresolved discrepancy, or prohibited redistribution |
| `methodology` | Approve constructs, protocols, thresholds, versions, validation claims, and experimental disposition | Precommitment where applicable, reproducible analysis, limitations, sensitivity, required independent review | Unpassed validation or external-review gate blocks stronger claims and graduation from beta |
| `editorial_copy` | Approve final factual, interpretive, methodological, promotional, and correction wording | Claim/source evidence, terminology and numeric checks, named human acceptance | Unsupported certainty, concealed judgment, anonymous authorship, or release mismatch |
| `corrections` | Triage reports; approve correction, retraction, preservation, response, and appeal disposition | Original report, affected versions, investigation, outcome, notice, reporter response where possible | Credible material error pauses promotion; safety or legal risk may require immediate suppression |
| `releases` | Authorize preview, frozen, DOI, superseding, rollback, and retired states | Commit/data identity, bill of materials, checksums, rights, gates, notes, citation metadata | Applicable P0 failure, identity drift, missing rights decision, or incomplete required review |
| `security` | Accept residual risk; restrict access; rotate credentials; disclose incidents; approve restoration | Incident/risk record, scope, containment, impact, verification, disclosure decision, follow-up | Suspected active compromise requires fail-closed suspension before availability goals |
| `source_rights` | Approve use, display, export, archive, attribution, and removal by source and surface | Rights manifest, exact terms, field/product posture, required legal review, release linkage | Pending, conflicting, expired, or insufficient rights block disputed publication and public bulk redistribution |
| `reviewer_independence` | Approve scope, process, conflict treatment, compensation, contact, and separate author response | Criteria, conflicts/recusals, pinned packet, outcome-independent terms, original report, consent state | Contingent benefit, material undisclosed conflict, answer leakage, or altered report invalidates the affected review |
| `conflicts` | Resolve project, author, contributor, reviewer, source-provider, funder, vendor, and competitive interests | Dated disclosure, affected decision, materiality, management/recusal/exclusion, alternate if appointed, public disclosure where relevant | Unmanageable conflict or refusal to disclose removes the person; Fernando's unmanageable conflict blocks the affected claim pending independent resolution |
| `emergency_action` | Temporarily suppress a route, fact, export, credential, job, or release to contain credible harm | Time, actor, trigger, action, scope, preservation, impact, review deadline, restoration criteria, appropriate later notice | Restoration waits for resolved cause, passing checks, and Fernando's recorded decision |

## Independent review

Reviewers control their conclusions. Civica preserves each original report and answers it separately. Publication or naming requires the reviewer's explicit consent. Compensation is fixed before the conclusion, pays for the agreed work, and never depends on agreement or a favorable result. Review does not imply endorsement, authorship, advisory-board service, or validation of unrelated claims.

Fernando approves the process and final project disposition. He cannot rewrite a review, hide an unresolved material finding from the decision record, or treat model output as independent peer review. A reviewer with a source or method conflict cannot be the sole judge of Civica's handling of that source or method.

## Conflicts and recusals

Relevant financial, professional, personal, institutional, source-provider, funder, vendor, political, and competitive interests must be recorded before the affected decision. The outcome is one of: disclose and manage, recuse and appoint a named independent decision-maker, or exclude the person from the decision.

Because Civica currently has no second internal human, an unmanageable conflict held by Fernando cannot be solved through self-recusal alone. The affected claim or release stays blocked until a qualified independent person is formally appointed for that decision and the appointment is recorded.

## Emergency action

Fernando may immediately suspend a public or operational surface when there is credible evidence of active compromise, material misinformation, unlawful or unlicensed publication, privacy exposure, or other ongoing harm. Availability is secondary to containment.

The action record must state what changed, why, who acted, the affected versions, evidence preservation, user impact, and restoration criteria. Review begins within 72 hours. When the action materially changes a public research claim or release, Civica publishes a dated notice; security-sensitive detail may be delayed only while disclosure would create further risk.

Restoration requires resolution of the trigger, applicable checks, and a named decision. Emergency authority does not permit permanent silent deletion of inconvenient evidence or criticism.

## Minimum decision record

Every material decision records:

1. identifier, domain, named actor, date, and authority;
2. artifact, claim, source, route, release, or incident in scope;
3. evidence, checks, conflicts, and recusals;
4. outcome, reasons, external criticism or dissent, and unresolved limits; and
5. implementation commit/data identity, notice, review date, and supersession link.

## Amendments

Review this charter at least annually and whenever Civica adds an accountable role or legal entity, accepts a material funding relationship, experiences a material incident, or changes its publication model. Amendments receive a new version and preserve the old text. They cannot retroactively authorize an earlier decision.

The machine-readable counterpart is `data/research/publication-governance-charter-v1.json`. GOV-002–GOV-005 will carry this authority into authorship, disclosure, AI-use, correction, retraction, version, and public policy surfaces.
