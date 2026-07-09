/**
 * Canonical epistemic tiers for public Civica claims.
 *
 * These identifiers are deliberately about the kind of evidence behind a
 * claim, not its visual treatment. UI language may become shorter, but it
 * must preserve the disclosure requirements recorded here and in
 * plan/decisions/claim-tier-v1.md.
 */

export const PUBLIC_CLAIM_TIER_IDS = [
  "institutional-posture",
  "source-reported-fact",
  "reconciled-fact",
  "derived-descriptive-metric",
  "research-beta-estimate",
  "experimental-heuristic",
  "retired-deprecated-output",
] as const;

export type PublicClaimTierId = (typeof PUBLIC_CLAIM_TIER_IDS)[number];

export interface PublicClaimTierDefinition {
  id: PublicClaimTierId;
  label: string;
  definition: string;
  allowedLanguage: readonly string[];
  requiredDisclosure: readonly string[];
  prohibitedLanguage: readonly string[];
}

export const PUBLIC_CLAIM_TIERS: Record<
  PublicClaimTierId,
  PublicClaimTierDefinition
> = {
  "institutional-posture": {
    id: "institutional-posture",
    label: "Institutional posture",
    definition:
      "A verifiable statement about Civica's scope, status, policy, process, rights posture, or future commitment rather than a country measurement.",
    allowedLanguage: [
      "Civica publishes…",
      "The project is in beta…",
      "The project plans to…",
    ],
    requiredDisclosure: [
      "Name the current status and effective date when the claim can change.",
      "Distinguish a shipped capability from a target, plan, or application route.",
      "Link to the governing policy, implementation, or status evidence.",
    ],
    prohibitedLanguage: [
      "Do not imply independent review, authority, openness, or completeness before the relevant gate passes.",
      "Do not present an aspiration as a current institutional fact.",
    ],
  },
  "source-reported-fact": {
    id: "source-reported-fact",
    label: "Source-reported fact",
    definition:
      "A value or statement reproduced from one named upstream publisher without Civica choosing among competing observations.",
    allowedLanguage: ["Source X reports…", "According to Source X…"],
    requiredDisclosure: [
      "Show publisher, observation period or vintage, retrieval or release date, and rights posture.",
      "Keep source caveats and forecast/measurement status attached.",
    ],
    prohibitedLanguage: [
      "Do not describe the value as Civica's finding.",
      "Do not call one source definitive when the source itself does not.",
    ],
  },
  "reconciled-fact": {
    id: "reconciled-fact",
    label: "Reconciled fact",
    definition:
      "A canonical value selected by Civica from multiple source observations using a versioned reconciliation rule.",
    allowedLanguage: [
      "Civica's reconciled value is…",
      "Selected from the listed sources under reconciliation version…",
    ],
    requiredDisclosure: [
      "Show the selected source, alternate observations, relevant vintages, rights, and reconciliation version.",
      "Expose disputes, overrides, missingness, and the correction path.",
    ],
    prohibitedLanguage: [
      "Do not call the selection objective truth, authoritative, or universally source-complete.",
      "Do not claim per-value provenance beyond measured coverage.",
    ],
  },
  "derived-descriptive-metric": {
    id: "derived-descriptive-metric",
    label: "Derived descriptive metric",
    definition:
      "A transparent arithmetic transformation, count, rate, distribution, or comparison built from identified observations without estimating a latent normative construct.",
    allowedLanguage: [
      "Calculated from…",
      "Coverage is…",
      "The observed difference is…",
    ],
    requiredDisclosure: [
      "Name inputs, formula, unit, vintage, exclusions, missing-data rule, and transformation version.",
      "Use a dated release fact or a generated runtime value for changing counts.",
    ],
    prohibitedLanguage: [
      "Do not infer causation or overall governance quality from a descriptive transformation.",
      "Do not hardcode a changing coverage claim without a date or generated state.",
    ],
  },
  "research-beta-estimate": {
    id: "research-beta-estimate",
    label: "Research-beta estimate",
    definition:
      "A versioned estimate of a defined construct that is still undergoing validation, sensitivity analysis, and external review.",
    allowedLanguage: [
      "Research-beta estimate…",
      "Experimental estimate under methodology version…",
    ],
    requiredDisclosure: [
      "Display beta status, construct, inputs, version, vintage, uncertainty posture, missingness, limitations, and validation state.",
      "Provide the methodology, correction path, and the gate required for stronger language.",
    ],
    prohibitedLanguage: [
      "Do not call the estimate validated, authoritative, definitive, or academically reviewed before G3/G5 evidence exists.",
      "Do not use normative letter grades or unsupported categorical country labels.",
      "Do not call heuristic simulation bounds confidence intervals for a true latent score.",
    ],
  },
  "experimental-heuristic": {
    id: "experimental-heuristic",
    label: "Experimental heuristic",
    definition:
      "A model-assisted signal, classifier output, rule-of-thumb score, or prototype whose observed output is not yet a validated measurement.",
    allowedLanguage: [
      "Experimental classifier output…",
      "Candidate signal…",
      "Event-ledger classification awaiting review…",
    ],
    requiredDisclosure: [
      "Show experimental status, ontology and pipeline version, source coverage, cadence, review state, known failure modes, and non-authoritative use warning.",
      "Separate an observed event record from any inferred numeric impact.",
    ],
    prohibitedLanguage: [
      "Do not equate no detected event with stability or no governance change.",
      "Do not claim daily, live, calibrated, or human-reviewed operation unless runtime evidence proves it.",
      "Do not present model agreement as academic validation.",
    ],
  },
  "retired-deprecated-output": {
    id: "retired-deprecated-output",
    label: "Retired or deprecated output",
    definition:
      "A historical field, score, grade, taxonomy, endpoint, or method retained only for auditability or migration.",
    allowedLanguage: [
      "Deprecated as of…",
      "Historical output; do not use for current analysis…",
    ],
    requiredDisclosure: [
      "Show retirement date, last valid version, reason, replacement or no-replacement decision, and sunset behavior.",
      "Keep historical access visibly separated from current outputs.",
    ],
    prohibitedLanguage: [
      "Do not show the output as current, recommended, or comparable across an incompatible methodology break.",
      "Do not silently revive a retired output without a new recorded decision and validation gate.",
    ],
  },
};
