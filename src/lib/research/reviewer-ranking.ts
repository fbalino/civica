import { createHash } from "node:crypto";
import { REVIEWER_LONGLIST } from "./reviewer-longlist";
import { REVIEWER_SELECTION_VERSION } from "./reviewer-selection";

export const REVIEWER_RANKING_VERSION = "civica-reviewer-ranking/v1" as const;

export const REVIEWER_RANKING_RUBRIC = Object.freeze({
  expertise: { weight: 25, scale: "0-5", evidence: "lane-specific methods record" },
  exactTaskFit: { weight: 25, scale: "0-5", evidence: "fit to the bounded Civica packet/question" },
  independence: { weight: 15, scale: "0-5", evidence: "distance from Civica and the judgment under review" },
  conflictManageability: { weight: 10, scale: "0-5", evidence: "whether disclosure, pairing, or recusal can protect the judgment" },
  perspectiveContribution: { weight: 15, scale: "0-5", evidence: "method/geographic/institutional contribution relative to the lane" },
  availabilitySignal: {
    weight: 5,
    scale: "0-5",
    evidence: "only explicit public availability for this kind of review; unknown receives zero and is not guessed",
  },
  communicationBurden: {
    weight: 5,
    scale: "0-5",
    evidence: "only public evidence that the exact scope/channel creates unusual burden; unknown receives zero and is not guessed",
  },
  scoring: "sum(weight * score / 5); ties resolve by expertise, exact fit, independence, then stable candidate id",
} as const);

type Scores = {
  expertise: number;
  exactTaskFit: number;
  independence: number;
  conflictManageability: number;
  perspectiveContribution: number;
  availabilitySignal: 0;
  communicationBurden: 0;
};

const RATINGS: Record<string, Omit<Scores, "availabilitySignal" | "communicationBurden">> = {
  "gov-a-munck": { expertise: 5, exactTaskFit: 5, independence: 5, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-a-little": { expertise: 5, exactTaskFit: 5, independence: 5, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-a-pemstein": { expertise: 5, exactTaskFit: 5, independence: 2, conflictManageability: 3, perspectiveContribution: 5 },
  "gov-a-claassen": { expertise: 5, exactTaskFit: 4, independence: 5, conflictManageability: 5, perspectiveContribution: 4 },
  "gov-a-meng": { expertise: 4, exactTaskFit: 5, independence: 5, conflictManageability: 5, perspectiveContribution: 4 },
  "gov-a-maerz": { expertise: 4, exactTaskFit: 4, independence: 2, conflictManageability: 3, perspectiveContribution: 5 },
  "gov-a-marquardt": { expertise: 5, exactTaskFit: 5, independence: 2, conflictManageability: 3, perspectiveContribution: 3 },
  "gov-a-boese": { expertise: 4, exactTaskFit: 4, independence: 2, conflictManageability: 3, perspectiveContribution: 4 },
  "gov-b-weidmann": { expertise: 5, exactTaskFit: 5, independence: 5, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-b-brandt": { expertise: 5, exactTaskFit: 5, independence: 4, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-b-restrepo": { expertise: 5, exactTaskFit: 5, independence: 5, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-b-osorio": { expertise: 5, exactTaskFit: 5, independence: 4, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-b-radford": { expertise: 5, exactTaskFit: 4, independence: 5, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-b-nussio": { expertise: 4, exactTaskFit: 4, independence: 5, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-b-dorazio": { expertise: 5, exactTaskFit: 5, independence: 4, conflictManageability: 5, perspectiveContribution: 4 },
  "gov-b-pinckney": { expertise: 4, exactTaskFit: 4, independence: 5, conflictManageability: 5, perspectiveContribution: 4 },
  "gov-c-vilhuber": { expertise: 5, exactTaskFit: 5, independence: 5, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-c-karcher": { expertise: 5, exactTaskFit: 5, independence: 5, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-c-simons": { expertise: 5, exactTaskFit: 5, independence: 5, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-c-peer": { expertise: 5, exactTaskFit: 5, independence: 5, conflictManageability: 5, perspectiveContribution: 4 },
  "gov-c-owango": { expertise: 4, exactTaskFit: 4, independence: 5, conflictManageability: 5, perspectiveContribution: 5 },
  "gov-c-zenk": { expertise: 5, exactTaskFit: 5, independence: 5, conflictManageability: 5, perspectiveContribution: 4 },
  "gov-c-briney": { expertise: 4, exactTaskFit: 4, independence: 5, conflictManageability: 5, perspectiveContribution: 4 },
  "gov-c-hoces": { expertise: 4, exactTaskFit: 4, independence: 5, conflictManageability: 5, perspectiveContribution: 4 },
};

function total(scores: Scores): number {
  return Number(
    Object.entries(scores)
      .reduce((sum, [axis, score]) => {
        const rubric = REVIEWER_RANKING_RUBRIC[axis as keyof Scores];
        return sum + (rubric.weight * score) / 5;
      }, 0)
      .toFixed(2),
  );
}

export function buildReviewerRanking() {
  const lanes = ["governance_measurement", "political_event_data", "research_data_curation"] as const;
  return {
    schemaVersion: REVIEWER_RANKING_VERSION,
    criteriaVersion: REVIEWER_SELECTION_VERSION,
    longlistVersion: REVIEWER_LONGLIST.schemaVersion,
    status: "draft_shortlist_owner_approval_required",
    contactStatus: "none",
    unknownPolicy: "Availability and communication burden remain zero-score unknowns until lawful post-GOV-016 contact; zero is not a negative finding.",
    rubric: REVIEWER_RANKING_RUBRIC,
    lanes: lanes.map((lane) => {
      const ranked = REVIEWER_LONGLIST.candidates
        .filter((candidate) => candidate.lane === lane)
        .map((candidate) => {
          const scores: Scores = { ...RATINGS[candidate.id], availabilitySignal: 0, communicationBurden: 0 };
          return { candidateId: candidate.id, name: candidate.name, scores, total: total(scores) };
        })
        .sort(
          (a, b) =>
            b.total - a.total ||
            b.scores.expertise - a.scores.expertise ||
            b.scores.exactTaskFit - a.scores.exactTaskFit ||
            b.scores.independence - a.scores.independence ||
            a.candidateId.localeCompare(b.candidateId),
        )
        .map((row, index) => ({
          ...row,
          rank: index + 1,
          disposition: index < 3 ? "proposed_primary" : index < 6 ? "alternate" : "reserve",
        }));
      return { lane, ranked };
    }),
  };
}

export function reviewerRankingHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function reviewerRankingErrors(ranking = buildReviewerRanking()): string[] {
  const errors: string[] = [];
  if (ranking.schemaVersion !== REVIEWER_RANKING_VERSION) errors.push("wrong ranking version");
  if (ranking.contactStatus !== "none" || !ranking.status.includes("owner_approval_required")) errors.push("contact/approval gate drifted");
  for (const lane of ranking.lanes) {
    if (lane.ranked.length !== 8) errors.push(`${lane.lane}: longlist coverage drifted`);
    if (lane.ranked.filter(({ disposition }) => disposition === "alternate").length < 3) errors.push(`${lane.lane}: fewer than three alternates`);
    if (lane.ranked.some((row, index) => row.rank !== index + 1)) errors.push(`${lane.lane}: rank sequence drifted`);
    if (lane.ranked.some(({ scores }) => scores.availabilitySignal !== 0 || scores.communicationBurden !== 0)) errors.push(`${lane.lane}: unknown availability/burden was guessed`);
  }
  if (Object.keys(RATINGS).length !== REVIEWER_LONGLIST.candidates.length) errors.push("not every longlist candidate is scored");
  return errors;
}
