import { INDEX_RESEARCH_CHARTER_VERSION } from "./research-charter";

export const INDEX_CANDIDATE_SPEC_VERSION = "civica-index-candidate-set/v1";

export type CandidateKind = "no-score-reference" | "derivative-benchmark" | "meta-measurement" | "fact-ledger" | "evidence-pairing" | "institutional-structure";

export interface IndexCandidateSpecification {
  id: string;
  name: string;
  kind: CandidateKind;
  construct: string;
  unit: string;
  cadence: string;
  claim: string;
  nonclaims: readonly string[];
  inputs: readonly string[];
  transforms: readonly string[];
  missingness: string;
  uncertainty: string;
  versioning: string;
  normativeChoices: readonly string[];
  expectedAddedValue: string;
  publicPresentation: string;
  validation: readonly string[];
  retirementRule: string;
  hiddenCountryQualityGrade: false;
  charterVersion: typeof INDEX_RESEARCH_CHARTER_VERSION;
}

const common = {
  hiddenCountryQualityGrade: false as const,
  charterVersion: INDEX_RESEARCH_CHARTER_VERSION,
};

export const INDEX_CANDIDATE_SPECIFICATIONS: readonly IndexCandidateSpecification[] = [
  {
    ...common,
    id: "K0",
    name: "Governance Evidence Dashboard",
    kind: "no-score-reference",
    construct: "No Civica construct; attributed display of established measurements",
    unit: "jurisdiction-indicator-period observation",
    cadence: "Each publisher release, frozen in Civica release vintages",
    claim: "Named publishers report these values on their own scales and vintages.",
    nonclaims: ["No Civica score", "No source consensus claim", "No country-quality comparison"],
    inputs: ["V-Dem", "WGI", "Freedom House", "Transparency International CPI", "UNDP HDI where contextually relevant"],
    transforms: ["None by default", "Direction labels only", "Optional visual rescaling is display-only and absent from exports"],
    missingness: "Display each absent source-period explicitly; never impute or carry forward.",
    uncertainty: "Pass through publisher intervals or standard errors only; otherwise state that no published uncertainty is retained.",
    versioning: "Pin source, indicator, upstream vintage, retrieval artifact, and Civica release.",
    normativeChoices: ["Which established sources qualify", "Display order", "Plain-language source descriptions"],
    expectedAddedValue: "A citable, provenance-rich comparison surface and the minimum product every derived candidate must beat.",
    publicPresentation: "Native-scale source rows with ownership, definition, vintage, direction, uncertainty, missingness, and citations; no average, grade, or overall rank.",
    validation: ["100% source-file fidelity on release fixtures", "Directionality comprehension test", "Rights and provenance coverage gates"],
    retirementRule: "Pull an affected indicator on systematic source drift or incompatible rights; the no-score baseline itself remains available while at least one compliant source exists.",
  },
  {
    ...common,
    id: "K1",
    name: "Hardened Four-Input Composite",
    kind: "derivative-benchmark",
    construct: "General governance-quality estimate as defined by four established judgment indicators",
    unit: "jurisdiction-period estimate",
    cadence: "Annual source-aligned release; no synthetic quarterly change",
    claim: "A research-beta weighted summary of four named upstream governance judgments.",
    nonclaims: ["Not an independent Civica observation", "Not causal", "Not an authoritative country verdict"],
    inputs: ["V-Dem Liberal Democracy Index", "WGI Rule of Law", "Freedom House total score", "Transparency International CPI"],
    transforms: ["Versioned native-to-common-scale transforms", "Fixed preregistered aggregation", "Competition ranking only if ranking survives the tournament"],
    missingness: "Apply ci-missingness/v1; label partial estimates and withhold insufficient cases.",
    uncertainty: "Use retained source-specific uncertainty and an explicit dependence model or publish no interval.",
    versioning: "Pin the complete input release set, transformation, weights, missingness, uncertainty, and rank policy.",
    normativeChoices: ["Construct scope", "Input selection", "Scale transforms", "Aggregation weights", "Publication threshold"],
    expectedAddedValue: "Tests whether a transparent summary improves a declared reader task enough to justify derivative complexity; it receives no presumption of value.",
    publicPresentation: "Research-beta point estimate with named inputs and limitations; no grades or judgmental bands.",
    validation: ["Exact clean-room reproduction", "Incremental user-task value versus single-source, equal-weight, factor, and dashboard baselines", "Full sensitivity and subgroup tests"],
    retirementRule: "Retire if it fails information novelty, meaningful incremental utility, uncertainty, comprehension, or misuse gates; a different input construct is a new candidate, not a rescue.",
  },
  {
    ...common,
    id: "K2",
    name: "Measurement Concordance",
    kind: "meta-measurement",
    construct: "Agreement and disagreement among eligible independent measurement projects within a named construct family",
    unit: "jurisdiction-construct-year rater profile",
    cadence: "Annual, recomputed for each frozen common-vintage source basket",
    claim: "Eligible sources place this jurisdiction this far apart on a declared common-coverage comparison.",
    nonclaims: ["Agreement is not truth", "Disagreement is not poor governance", "No overall-country concordance score"],
    inputs: ["At least three eligible raters per construct", "Source-dependence registry", "Published within-source uncertainty where retained"],
    transforms: ["Common-coverage percentile per source and construct", "Range and IQR across raters", "Drop-one-source stability classification"],
    missingness: "Require at least three eligible sources; otherwise report insufficient rater coverage without imputation.",
    uncertainty: "Separate within-source published uncertainty from between-source dispersion; never treat rater spread as a confidence interval.",
    versioning: "Version rater eligibility, construct mapping, common-coverage set, source basket, transforms, and release.",
    normativeChoices: ["Rater independence criteria", "Construct-family mapping", "Minimum source count", "Dispersion summary"],
    expectedAddedValue: "Makes disagreement that composites erase visible and testable at country-construct level.",
    publicPresentation: "One source dot-strip per construct with named raters and a 'what this does not mean' line; no country-wide aggregation.",
    validation: ["Midpoint-artifact test", "Drop-one-source stability", "Preregistered contested-versus-consensus expert set", "Reader misuse test"],
    retirementRule: "Do not ship if midpoint position explains the measure, source deletion is unstable, expert validity fails, or readers persistently read it as country quality.",
  },
  {
    ...common,
    id: "K3",
    name: "Power and Transfer Ledger",
    kind: "fact-ledger",
    construct: "Documented executive tenure, electoral transfer, alternation, and term-limit states",
    unit: "institutional event plus current jurisdiction state",
    cadence: "Event-driven with quarterly immutable vintages",
    claim: "These sourced events and rules establish the recorded executive transfer or term-limit state as of the stated date.",
    nonclaims: ["Alternation is not democracy", "Long tenure is not autocracy", "No aggregation into country quality"],
    inputs: ["Officeholder terms", "Election records", "Party and coalition identity", "Constitutional term-limit text", "Statement-level provenance"],
    transforms: ["Versioned rulebook application", "Date arithmetic", "No cross-field score or index"],
    missingness: "Show record-start dates, unknown components, and contested cases; never infer no transfer from an incomplete history.",
    uncertainty: "Use contested and unresolved statuses rather than stochastic intervals; retain coder disagreement and adjudication.",
    versioning: "Version the rulebook, identity mappings, evidence set, adjudications, and quarterly vintage.",
    normativeChoices: ["Chief-executive identity", "Person and coalition continuity", "Election linkage", "Interim and collective executives", "Disputed transfers"],
    expectedAddedValue: "A living, citable factual dataset where existing leader and institutional datasets are stale or lack statement-level provenance.",
    publicPresentation: "Dated transfer timeline, tenure and term-limit facts, citations, record coverage, and contested flags; sortable dates but no rank or valence.",
    validation: ["Blinded intercoder reliability", "Historical overlap against leader datasets", "Random citation audit", "Freshness service-level test"],
    retirementRule: "Retire derived states if rules remain unreliable; demote to vintage-only if freshness fails; preserve verified raw terms and evidence.",
  },
  {
    ...common,
    id: "K4",
    name: "Constitution-to-Practice Pairings",
    kind: "evidence-pairing",
    construct: "Nonaggregated pairing of a specific constitutional commitment with a matched external practice indicator",
    unit: "jurisdiction-commitment-period pairing",
    cadence: "On constitutional amendment and each external-indicator release",
    claim: "The cited text states this commitment, while the named external source reports this separate practice observation.",
    nonclaims: ["No hypocrisy score", "No causal claim", "No overall constitutional quality estimate"],
    inputs: ["Constitution excerpts and article references", "A small preregistered set of externally owned practice indicators", "Mapping codebook"],
    transforms: ["Versioned commitment-to-indicator mapping", "No subtraction, gap score, ranking, or aggregation"],
    missingness: "Omit unsupported pairings and state whether text, indicator, or fair mapping is absent.",
    uncertainty: "Show publisher uncertainty for the practice observation; code text ambiguity and mapping disagreement separately.",
    versioning: "Version constitutional text vintage, external source vintage, mapping codebook, coder decisions, and release.",
    normativeChoices: ["Commitment families", "Fair semantic match", "Treatment of qualifiers and exceptions"],
    expectedAddedValue: "Joins two evidence systems that readers currently reconcile manually while keeping both sides visible.",
    publicPresentation: "Constitution text and external observation side by side with separate citations and no gap adjective or score.",
    validation: ["Blinded mapping intercoder agreement", "Constitutional-scholar fair-pairing review", "Qualifier and exception edge cases", "Misuse comprehension test"],
    retirementRule: "Drop any commitment family below the preregistered mapping or expert-fairness threshold; retain the independent source observations.",
  },
  {
    ...common,
    id: "K5",
    name: "Institutional Constraint Map",
    kind: "institutional-structure",
    construct: "Descriptive allocation of formal appointment, removal, veto, dissolution, term, and review powers among named institutions",
    unit: "jurisdiction-institution-relation at a constitutional vintage",
    cadence: "Constitutional amendment or verified institutional change, with quarterly snapshots",
    claim: "The cited legal and institutional sources assign this formal power or constraint between these institutions.",
    nonclaims: ["Formal power is not effective practice", "More constraints are not necessarily better", "No democracy or governance-quality score"],
    inputs: ["Constitutional provisions", "Government taxonomy", "Office and body records", "Verified institutional sources", "Provenance statements"],
    transforms: ["Closed relation taxonomy", "Directed institution graph", "Descriptive counts only within a named relation class", "No weighted total"],
    missingness: "Unknown relations remain unknown; absence of evidence is never coded as absence of power.",
    uncertainty: "Use sourced, contested, superseded, and unresolved relation states; no probabilistic precision without a validated coding model.",
    versioning: "Version relation taxonomy, source text and vintage, codings, overrides, and graph release.",
    normativeChoices: ["Institution boundary", "Formal-power relation taxonomy", "De jure scope", "Treatment of emergency and reserve powers"],
    expectedAddedValue: "Turns Civica's constitutions and government taxonomy into a comparable, source-linked structural map without judging country quality.",
    publicPresentation: "Institution-to-institution diagram and relation table with citations, legal vintage, disputed edges, and an explicit de-jure-only warning.",
    validation: ["Double-coded relation reliability", "External taxonomy comparison", "Legal-expert review of stratified edge cases", "Graph invariants and source-trace audit"],
    retirementRule: "Abandon aggregate structural summaries if coding reliability or expert validity fails; retain only individually verified relations and source text.",
  },
] as const;

export function candidateSpecificationErrors(candidates: readonly IndexCandidateSpecification[]): string[] {
  const errors: string[] = [];
  if (candidates.length < 4) errors.push("fewer than four candidates");
  if (!candidates.some((candidate) => candidate.kind === "no-score-reference")) errors.push("dashboard/no-score candidate missing");
  if (new Set(candidates.map((candidate) => candidate.kind)).size < 4) errors.push("candidate kinds are not materially distinct");
  if (new Set(candidates.map((candidate) => candidate.construct)).size !== candidates.length) errors.push("candidate constructs are duplicated");
  const requiredArrays = ["nonclaims", "inputs", "transforms", "normativeChoices", "validation"] as const;
  const requiredStrings = ["id", "name", "construct", "unit", "cadence", "claim", "missingness", "uncertainty", "versioning", "expectedAddedValue", "publicPresentation", "retirementRule"] as const;
  for (const candidate of candidates) {
    for (const field of requiredArrays) if (candidate[field].length === 0) errors.push(`${candidate.id}.${field} is empty`);
    for (const field of requiredStrings) if (!candidate[field].trim()) errors.push(`${candidate.id}.${field} is empty`);
    if (candidate.hiddenCountryQualityGrade !== false) errors.push(`${candidate.id} permits a hidden country-quality grade`);
    if (candidate.charterVersion !== INDEX_RESEARCH_CHARTER_VERSION) errors.push(`${candidate.id} uses the wrong charter`);
  }
  return errors;
}
