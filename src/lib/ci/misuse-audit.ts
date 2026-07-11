import { researchPanelHash } from "./research-panel";

export const INDEX_MISUSE_AUDIT = Object.freeze({
  schemaVersion: "civica-index-misuse-audit/v1",
  auditId: "index-misuse-audit-v1",
  target: "K1 current derivative composite and its current public presentation",
  reviewerLenses: [
    "comparative measurement and construct validity",
    "cross-cultural and regime classification",
    "data journalism and headline incentives",
    "public policy and consequential allocation",
    "data-poor and small-state representation",
  ],
  findings: [
    { id: "arbitrary-specification", severity: "high", likelihood: "high", status: "fails_current_presentation", evidence: "Dimension deletion moves p95 ranks by 23–33 places; normalization and median aggregation move them by 14.", risk: "A single rank looks empirically necessary although editorial inclusion and transformation choices materially determine it.", mitigation: "Show native inputs and specification sensitivity; do not present one ordering as uniquely measured.", trigger: "Suspend recommended composite display if a material alternative changes p95 ranks by more than 10 places." },
    { id: "regime-cultural-assumptions", severity: "high", likelihood: "medium", status: "unresolved", evidence: "The composite combines liberal democracy, Freedom House rights, WGI rule of law, and corruption perceptions into one better-to-worse axis.", risk: "A broad liberal-governance ideal may be mistaken for a culture-neutral description of all governance quality.", mitigation: "Name the normative tradition and constructs; never label the total as governance quality without qualification; obtain geographically diverse review.", trigger: "Retire the totalizing claim if external reviewers cannot agree on a bounded construct and interpretation." },
    { id: "false-precision", severity: "critical", likelihood: "high", status: "fails_current_presentation", evidence: "The site exposes a 0–100 score and sortable order although no calibrated composite confidence interval exists and rank shifts occur under plausible specifications.", risk: "Readers infer meaningful one-point and one-rank differences.", mitigation: "Remove exact-rank emphasis; publish source values, sensitivity, ties/indistinguishable positions, and explicit absence of composite uncertainty.", trigger: "Suspend exact score/rank publication whenever uncertainty or specification dependence cannot distinguish adjacent positions." },
    { id: "league-table-incentive", severity: "critical", likelihood: "high", status: "fails_current_presentation", evidence: "The public rankings table defaults to descending Civica Index and metadata advertises country rankings.", risk: "The product encourages best/worst-country headlines and strips away provenance and disagreement.", mitigation: "Remove K1 as the default rankings sort and from featured leaderboard cards; make the source-native dashboard the comparison surface.", trigger: "Any promotion, press use, or partner embed framing K1 as a best/worst governance league table requires immediate demotion pending review." },
    { id: "media-misuse", severity: "high", likelihood: "high", status: "fails_current_presentation", evidence: "A single sortable number, country rank, and API distribution are easier to quote than the methodology limits.", risk: "Headlines reproduce the number while omitting derivative status, vintage, overlap, and sensitivity.", mitigation: "Require compact citations and limitations in exports/embeds; provide a misuse-safe summary; monitor first external citations.", trigger: "Two material external citations omitting beta/derivative status trigger removal from embeds and SEO surfaces." },
    { id: "policy-consequential-use", severity: "critical", likelihood: "medium", status: "unresolved", evidence: "No validation supports aid allocation, sanctions, procurement, migration, credit, or automated risk decisions.", risk: "A convenient API field may be used in consequential eligibility or resource allocation.", mitigation: "Add a machine-readable and human-readable prohibition on consequential use; exclude K1 from bulk decision-ready schemas.", trigger: "Documented consequential use triggers immediate suspension and governance review." },
    { id: "historical-revision", severity: "high", likelihood: "medium", status: "fails_without_vintage", evidence: "V-Dem revisions change 526 rounded scores; BR event-label Jan24/Jan26 common-window Jaccard is 84.9%.", risk: "A revised backcast appears to describe political change that never occurred in the stated year.", mitigation: "Bind every value and comparison to exact input and label editions; never overwrite cited releases.", trigger: "Any score without exact vintage and reconstruction hash is withdrawn from citation surfaces." },
    { id: "poor-observation-harm", severity: "high", likelihood: "medium", status: "controlled_but_unresolved", evidence: "K1 does not mechanically penalize the observed three-source pattern, but small states average 2.53 bounded dimensions versus 3.00 and one sovereign state is withheld.", risk: "Thin evidence can still look equally certain or exclusion can erase atypical states.", mitigation: "Display source count and missingness beside every result; never impute; suppress comparisons with materially unequal evidence.", trigger: "Fail K1 if scarcity lowers the masked median by more than one point, moves more than 60% downward, or missingness is hidden." },
  ],
  disposition: {
    currentPresentationPassesMisuseGate: false,
    underlyingCandidateAutomaticallyRetired: false,
    permittedNow: "versioned internal research and clearly bounded methodology evidence",
    prohibitedNow: "recommended country ranking, best/worst framing, consequential use, or original/independently corroborated measurement claim",
    requiredBeforeSecondaryPublicUse: ["remove default league-table treatment", "publish specification sensitivity", "bind every value to exact vintage", "add consequential-use prohibition", "complete qualified reader nonclaim test", "complete geographically diverse external review"],
  },
} as const);

export const INDEX_MISUSE_AUDIT_SHA256 = researchPanelHash(INDEX_MISUSE_AUDIT);

export function misuseAuditErrors(audit = INDEX_MISUSE_AUDIT): string[] {
  const errors: string[] = [];
  const required = ["arbitrary-specification", "regime-cultural-assumptions", "false-precision", "league-table-incentive", "media-misuse", "policy-consequential-use", "historical-revision", "poor-observation-harm"];
  for (const id of required) if (!audit.findings.some((finding) => finding.id === id)) errors.push(`missing ${id}`);
  for (const finding of audit.findings) if (!finding.mitigation || !finding.trigger || !finding.evidence) errors.push("incomplete finding");
  if (audit.disposition.currentPresentationPassesMisuseGate) errors.push("current presentation incorrectly passes");
  if (audit.disposition.underlyingCandidateAutomaticallyRetired) errors.push("audit bypasses tournament disposition");
  return errors;
}
