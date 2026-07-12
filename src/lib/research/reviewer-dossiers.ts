import { createHash } from "node:crypto";
import { REVIEWER_LONGLIST } from "./reviewer-longlist";
import { buildReviewerRanking, REVIEWER_RANKING_VERSION } from "./reviewer-ranking";

export const REVIEWER_DOSSIER_VERSION = "civica-reviewer-dossiers/v1" as const;

const LANE_SCOPE = {
  governance_measurement: {
    packet: "GOV-014 Index tournament review packet",
    hours: "8–12 hours over three weeks",
    question: "Did the preregistered tournament fairly test originality, redundancy, stability, uncertainty, usefulness, and misuse, and does the no-winner/source-native disposition follow from the evidence?",
    deliverable: "A structured memo answering the frozen questions, ranking material findings, identifying supported/unsupported claims, and recording unresolved methodological disagreement.",
    artifacts: ["plan/research/index-tournament-preregistration-v3.md", "plan/research/index-tournament-confirmatory-decision-v1.md", "plan/research/index-disposition-resolution-v1.md", "data/releases/civica-index-research-archive-2026-07-v1/manifest.v1.json"],
  },
  political_event_data: {
    packet: "GOV-015 Pulse review packet (after prospective evaluation)",
    hours: "12–16 hours over four weeks",
    question: "Are the ledger construct, ontology, retrieval boundaries, sampling frames, observability rules, blinded coding/adjudication, and full-pipeline evaluation appropriate for Pulse's proposed claims?",
    deliverable: "A structured memo covering construct, sampling, coding, observability, full-pipeline metrics, subgroup limits, error taxonomy, prospective protocol, and supportable/unsupported claims.",
    artifacts: ["plan/research/pulse-event-ontology-v3.md", "plan/research/pulse-evaluation-sampling-preregistration-v1.md", "plan/research/pulse-country-day-evaluation-set-v1.md", "data/research/pulse-evaluation-packet-manifest-v1.json"],
  },
  research_data_curation: {
    packet: "GOV-013 Atlas/data-curation review packet",
    hours: "8–12 hours over three weeks",
    question: "Does the frozen release provide adequate metadata, provenance, rights, preservation, versioning, citation, checksums, codebook, correction, and clean-room reconstruction for responsible reuse?",
    deliverable: "A completed artifact checklist, attempted clean-room reproduction and link/checksum report, and severity-ranked curation, preservation, citation, rights, and reuse findings.",
    artifacts: ["data/releases/atlas-2026-07-11/g2-rc1/bundle-manifest.v1.json", "data/releases/atlas-2026-07-11/g2-rc1/REPRODUCE.md", "data/releases/atlas-2026-07-11/g2-rc1/rights-manifest.v1.json", "data/releases/atlas-2026-07-11/g2-rc1/KNOWN-LIMITATIONS.md"],
  },
} as const;

export function buildReviewerDossiers() {
  const selected = buildReviewerRanking().lanes.flatMap((lane) =>
    lane.ranked.filter(({ disposition }) => disposition !== "reserve"),
  );
  return {
    schemaVersion: REVIEWER_DOSSIER_VERSION,
    rankingVersion: REVIEWER_RANKING_VERSION,
    status: "drafts_only_no_contact",
    honorariumPosture: "Amount and logistics remain pending GOV-012 owner approval. Any eventual offer is standardized for comparable scope, paid for time regardless of conclusion, and never contingent on a favorable review.",
    publicationPosture: "The original report, conflict disclosure, and author response are preserved. Public attribution or report publication requires the reviewer's explicit consent; unfavorable or unresolved findings are not suppressed.",
    contactGate: "These drafts must not be sent before GOV-016 passes and the owner approves identities, order, conflicts, honoraria, and exact copy.",
    dossiers: selected.map((ranked) => {
      const candidate = REVIEWER_LONGLIST.candidates.find(({ id }) => id === ranked.candidateId);
      if (!candidate) throw new Error(`${ranked.candidateId}: missing longlist record`);
      const scope = LANE_SCOPE[candidate.lane];
      return {
        candidateId: candidate.id,
        name: candidate.name,
        lane: candidate.lane,
        shortlistStatus: ranked.disposition,
        rank: ranked.rank,
        whyThisPerson: `${candidate.methodContribution} ${candidate.exactFit}`,
        exactQuestion: scope.question,
        packet: scope.packet,
        artifacts: [...scope.artifacts],
        expectedTime: scope.hours,
        deliverable: scope.deliverable,
        conflictTerms: `${candidate.conflictsAndDependencies} Before access, request a direct disclosure and apply the GOV-008 recusal/pairing rule; withdrawal or recusal carries no penalty.`,
        publicationTerms: "Civica will preserve the original report and answer findings in a versioned response. Public naming or report publication requires explicit consent. Review does not imply endorsement, authorship, advisory-board service, or validation of unrelated Civica claims.",
        honorariumTerms: "Honorarium amount pending GOV-012. Any offer will be consistent for comparable work, paid for time, and independent of the conclusion.",
        contactDraft: {
          subject: `Independent review request: ${scope.packet}`,
          body: `Dear ${candidate.name},\n\nI am preparing Civica Atlas, a provenance-first comparative reference to how countries are governed. I am writing because your work on ${candidate.methodPerspective.toLowerCase()} is unusually close to one bounded question we need examined independently.\n\nThe proposed question is: ${scope.question}\n\nThe review would involve ${scope.hours} and the requested deliverable would be: ${scope.deliverable}\n\nBefore sharing a version-pinned packet, I would ask you to confirm availability and any financial, institutional, source-project, collaborative, or competitive relationships relevant to this judgment. ${candidate.conflictsAndDependencies}\n\nAn honorarium amount is still subject to owner approval under a policy that pays for time and never for a favorable conclusion. We preserve critical and unresolved findings; public attribution or publication of your report would occur only with your consent. The assignment would not imply endorsement, authorship, or advisory-board membership.\n\nIf the scope is outside your interests or capacity, a brief decline is completely sufficient and no explanation is needed. No materials or follow-up would be sent without your agreement.\n\nSincerely,\nFernando Balino\nCivica Atlas`,
        },
        contacted: false as const,
      };
    }),
  };
}

export function reviewerDossierHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function reviewerDossierErrors(bundle = buildReviewerDossiers()): string[] {
  const errors: string[] = [];
  if (bundle.schemaVersion !== REVIEWER_DOSSIER_VERSION) errors.push("wrong dossier version");
  if (bundle.status !== "drafts_only_no_contact" || !bundle.contactGate.includes("GOV-016")) errors.push("contact gate drifted");
  if (bundle.dossiers.length !== 18) errors.push("18 primary/alternate dossiers are required");
  for (const dossier of bundle.dossiers) {
    if (!dossier.whyThisPerson || !dossier.exactQuestion || !dossier.expectedTime || !dossier.deliverable || !dossier.conflictTerms || !dossier.publicationTerms || !dossier.honorariumTerms) errors.push(`${dossier.candidateId}: dossier is incomplete`);
    if (dossier.artifacts.length < 4 || dossier.contacted !== false) errors.push(`${dossier.candidateId}: artifacts/contact state drifted`);
    if (!dossier.contactDraft.body.includes(dossier.exactQuestion) || !dossier.contactDraft.body.includes("no explanation is needed")) errors.push(`${dossier.candidateId}: contact draft is generic or coercive`);
  }
  if (/mailto:|@[a-z0-9.-]+\.[a-z]{2,}|\+\d{7,}/i.test(JSON.stringify(bundle))) errors.push("direct contact data entered dossiers");
  return errors;
}
