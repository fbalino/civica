export const INDEX_RESEARCH_CHARTER_VERSION = "civica-original-measurement-charter/v1";
export const INDEX_RESEARCH_CHARTER_PATH = "plan/research/index-research-charter-v1.md";

export const INDEX_RESEARCH_CHARTER = {
  targetUsers: ["comparative-politics researchers", "data journalists", "civil-society analysts", "educators", "public-sector researchers"],
  supportedDecisions: ["find and cite institutional facts", "inspect source agreement and disagreement", "compare documented changes", "select evidence for transparent analysis"],
  allowedUnits: ["jurisdiction-period", "documented-event", "institutional-state", "source-pair", "jurisdiction-construct-year"],
  cadence: ["source-release", "event-driven", "annual", "frozen-vintage"],
  eligibleConstructFamilies: ["provenance-native-fact-measurement", "measurement-ecosystem-meta-measurement"],
  causalStanding: "descriptive_unless_separately_preregistered",
  noveltyTests: ["not-recoverable-from-one-upstream-field-or-judgment-recombination", "beats-relevant-simple-baseline-on-preregistered-user-task"],
  mandatoryBaselines: ["best-single-established-indicator-where-coherent", "transparent-simple-aggregate-or-factor-where-coherent", "source-native-dashboard-no-score"],
  forbiddenClaims: ["overall-country-worth", "democratic-legitimacy", "governability", "future-stability", "policy-effectiveness", "moral-standing"],
  prohibitedPresentation: ["letter-grades", "judgmental-country-labels", "traffic-light-verdicts", "overall-country-rank"],
  retirement: { annualReview: true, consecutiveRequiredGateFailures: 2, immediateSuspensionFor: ["serious-rights-breach", "unverifiable-published-result", "demonstrated-consequential-harm"] },
  noWinnerAllowed: true,
  currentCompositeIncumbencyAdvantage: false,
} as const;

export function researchCharterErrors(markdown: string): string[] {
  const required = ["## Purpose", "## Unit and cadence", "## Eligible constructs", "## Claim boundary", "## Novelty requirement", "## Misuse controls", "## Falsification and retirement", "No candidate winning is an acceptable outcome"];
  return required.filter((phrase) => !markdown.includes(phrase)).map((phrase) => `charter omits: ${phrase}`);
}
