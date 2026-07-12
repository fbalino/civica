import { createHash } from "node:crypto";

export const PUBLICATION_GOVERNANCE_VERSION =
  "civica-research-publication-governance/v1" as const;

export const GOVERNANCE_DOMAINS = [
  "data",
  "methodology",
  "editorial_copy",
  "corrections",
  "releases",
  "security",
  "source_rights",
  "reviewer_independence",
  "conflicts",
  "emergency_action",
] as const;

export type GovernanceDomain = (typeof GOVERNANCE_DOMAINS)[number];

const accountable = "Fernando Balino" as const;

export const PUBLICATION_GOVERNANCE_CHARTER = Object.freeze({
  schemaVersion: PUBLICATION_GOVERNANCE_VERSION,
  effectiveOn: "2026-07-11",
  status: "operative_single_owner_charter",
  scope:
    "Research, data, methodology, editorial publication, software-supported release operations, and external review for Civica Atlas.",
  accountableHuman: Object.freeze({
    name: accountable,
    currentCapacity: "Founder, publisher, and responsible human decision-maker",
    concentrationDisclosure:
      "Civica currently has one accountable human. This is a governance limitation: separation of duties is supplied only by enforced gates, immutable records, and independent external criticism, not by an internal multi-person approval body.",
  }),
  authorityRules: Object.freeze([
    "Only a named human may approve, reject, suspend, retract, or release research or public claims.",
    "Software agents and language models may research, draft, test, audit, and recommend. They have no authorship, approval, conflict-waiver, reviewer-selection, spending, publication, or emergency-restoration authority.",
    "A validator passing is evidence for a decision, not the decision itself.",
    "No role or responsibility may be attributed to an anonymous Civica Team. A future delegate must be named in a versioned appointment with scope, start date, end or review date, and recusal route.",
    "The accountable human may not waive a frozen gate silently. A waiver requires a versioned exception naming the evidence, risk, duration, affected claim, and rollback or correction path.",
  ]),
  decisions: Object.freeze([
    {
      domain: "data",
      accountable,
      decision: "Approve source ingestion, reconciliation rules, derived fields, quality disposition, and inclusion in a frozen release.",
      requiredEvidence: "Versioned source/input manifests, provenance coverage, validation results, rights state, and a release-linked decision record.",
      stopCondition: "Unknown provenance, failed integrity gate, unresolved material discrepancy, or prohibited redistribution blocks release of the affected material.",
    },
    {
      domain: "methodology",
      accountable,
      decision: "Approve constructs, estimands, protocols, thresholds, version changes, validation claims, and experimental disposition.",
      requiredEvidence: "Preregistered or precommitted protocol where applicable, reproducible analysis, limitations, sensitivity results, and required independent review.",
      stopCondition: "A required validation or external-review gate that has not passed blocks stronger claims and graduation from beta.",
    },
    {
      domain: "editorial_copy",
      accountable,
      decision: "Approve reader-facing factual, interpretive, methodological, promotional, and correction copy.",
      requiredEvidence: "Claim registry and source links where applicable, terminology and numeric-claim checks, and named human acceptance of final wording.",
      stopCondition: "Unsupported certainty, concealed judgment, anonymous authorship, or mismatch with the underlying release blocks publication.",
    },
    {
      domain: "corrections",
      accountable,
      decision: "Triage reports, classify severity, approve corrections or retractions, preserve history, and answer appeals.",
      requiredEvidence: "Original report, affected versions and claims, investigation record, disposition, correction notice, and reporter response where possible.",
      stopCondition: "A credible material-error report pauses promotion of the affected claim until triage; safety or legal risk may require immediate temporary suppression.",
    },
    {
      domain: "releases",
      accountable,
      decision: "Authorize preview, frozen, DOI, superseding, rollback, or retired release states.",
      requiredEvidence: "Named commit and data identity, bill of materials, checksums, rights state, gate report, release notes, and citation/version metadata.",
      stopCondition: "Any applicable P0 gate failure, identity drift, missing rights decision, or incomplete required review blocks release.",
    },
    {
      domain: "security",
      accountable,
      decision: "Accept residual security risk, restrict access, rotate credentials, disclose incidents, and approve restoration after containment.",
      requiredEvidence: "Incident or risk record, scope, containment evidence, credential and data impact, verification, disclosure decision, and follow-up tasks.",
      stopCondition: "Suspected active compromise or unsafe access state requires fail-closed suspension before availability goals.",
    },
    {
      domain: "source_rights",
      accountable,
      decision: "Approve use, display, export, archive, attribution, and removal posture for each source and release surface.",
      requiredEvidence: "Machine-readable rights manifest, exact terms and retrieval evidence, field/product posture, legal review when required, and release linkage.",
      stopCondition: "Pending, conflicting, expired, or insufficient rights fail closed for public bulk redistribution and any disputed surface.",
    },
    {
      domain: "reviewer_independence",
      accountable,
      decision: "Approve reviewer scope, selection process, conflict treatment, compensation, contact, and author response without controlling the reviewer's conclusion.",
      requiredEvidence: "Predeclared criteria, recorded conflicts and recusals, version-pinned packet, outcome-independent terms, original report, and consented publication state.",
      stopCondition: "Outcome-contingent benefit, undisclosed material conflict, answer leakage, or owner alteration of a report invalidates the review for the affected judgment.",
    },
    {
      domain: "conflicts",
      accountable,
      decision: "Record and resolve project, author, contributor, reviewer, source-provider, funder, vendor, and competing-interest conflicts.",
      requiredEvidence: "Dated disclosure, affected decision, materiality assessment, management/recusal/exclusion outcome, alternate decision-maker if one is appointed, and public disclosure where relevant.",
      stopCondition: "An unmanageable conflict or refusal to disclose blocks the affected person from the decision; the sole owner's unmanageable conflict blocks the affected claim or release pending independent resolution.",
    },
    {
      domain: "emergency_action",
      accountable,
      decision: "Temporarily suppress a route, fact, export, credential, job, or release to contain credible harm, compromise, rights breach, or material misinformation.",
      requiredEvidence: "Time, actor, trigger, exact action, affected scope, preservation step, user impact, review deadline, restoration criteria, and later public notice when appropriate.",
      stopCondition: "Restoration is prohibited until the trigger is resolved, relevant checks pass, and the named accountable human records the decision.",
    },
  ]),
  reviewerIndependence: Object.freeze({
    reviewerOwnsConclusion: true,
    originalReportPreserved: true,
    publicationRequiresConsent: true,
    outcomeContingentCompensationProhibited: true,
    ownerResponseSeparate: true,
    endorsementNotImplied: true,
  }),
  emergencyProtocol: Object.freeze({
    immediateAuthority: accountable,
    defaultReviewDeadlineHours: 72,
    preservationBeforeDeletion:
      "Preserve the minimum lawful evidence and affected release identity before deletion unless doing so would extend active harm or violate law.",
    notice:
      "Publish a dated notice when an emergency action materially changes a public research claim or release; delay security-sensitive detail only while disclosure would create additional risk.",
  }),
  records: Object.freeze([
    "decision identifier, domain, named actor, date, and authority",
    "artifact, claim, source, route, release, or incident in scope",
    "evidence considered, checks run, conflicts, and recusals",
    "decision, reasons, dissent or external criticism, and unresolved limits",
    "implementation commit/data identity, public notice, review date, and supersession link",
  ]),
  amendment:
    "Review at least annually and after a new accountable role, legal entity, funding relationship, material incident, or publication model. Amendments are versioned, preserve prior charters, and cannot retroactively legitimize an earlier decision.",
});

export function publicationGovernanceHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function publicationGovernanceErrors(
  charter: typeof PUBLICATION_GOVERNANCE_CHARTER = PUBLICATION_GOVERNANCE_CHARTER,
): string[] {
  const errors: string[] = [];
  if (charter.schemaVersion !== PUBLICATION_GOVERNANCE_VERSION) errors.push("wrong schema version");
  const domains = new Set(charter.decisions.map(({ domain }) => domain));
  if (GOVERNANCE_DOMAINS.some((domain) => !domains.has(domain)) || domains.size !== GOVERNANCE_DOMAINS.length)
    errors.push("decision-domain closure drifted");
  for (const row of charter.decisions) {
    if (row.accountable !== accountable) errors.push(`${row.domain}: unnamed or wrong accountable human`);
    if (!row.decision || !row.requiredEvidence || !row.stopCondition)
      errors.push(`${row.domain}: decision contract is incomplete`);
  }
  const serialized = JSON.stringify(charter);
  if (/"accountable":"(?:the )?Civica Team"/i.test(serialized))
    errors.push("anonymous team responsibility is prohibited");
  if (!serialized.includes("no authorship") || !serialized.includes("no authorship, approval"))
    errors.push("automation authority boundary is absent");
  if (!charter.accountableHuman.concentrationDisclosure.includes("one accountable human"))
    errors.push("single-owner concentration is not disclosed");
  return errors;
}
