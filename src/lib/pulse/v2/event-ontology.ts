import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_INDEX,
  type EventDirection,
} from "./taxonomy";
import { PULSE_DIMENSIONS, type PulseDimension } from "./types";

export const PULSE_EVENT_ONTOLOGY_VERSION =
  "pulse-event-ontology/v3.0" as const;

export const ONTOLOGY_EFFECT_DIRECTIONS = [
  "expansive",
  "restrictive",
  "mixed",
  "unclear",
  "not_assessed",
] as const;
export type OntologyEffectDirection =
  (typeof ONTOLOGY_EFFECT_DIRECTIONS)[number];

export const ONTOLOGY_SEVERITY_DESCRIPTORS = Object.freeze({
  not_assessed: Object.freeze({
    label: "Not assessed",
    definition:
      "The occurrence label is supported, but its institutional scope or intensity has not been assessed.",
  }),
  limited: Object.freeze({
    label: "Limited",
    definition:
      "A localized, short-duration, narrowly targeted, or readily reversible institutional occurrence.",
  }),
  material: Object.freeze({
    label: "Material",
    definition:
      "A documented occurrence with substantial reach within an institution, jurisdiction, or affected population, without threatening the institutional order as a whole.",
  }),
  major: Object.freeze({
    label: "Major",
    definition:
      "A national, prolonged, difficult-to-reverse, or core-institution occurrence with broad practical consequences.",
  }),
  critical: Object.freeze({
    label: "Critical",
    definition:
      "An occurrence that disrupts the constitutional or institutional order, affects a very large population, or creates severe and difficult-to-reverse consequences.",
  }),
} as const);

export type OntologySeverityDescriptor =
  keyof typeof ONTOLOGY_SEVERITY_DESCRIPTORS;

export interface OntologyLabelAssertion {
  categoryId: string;
  /** Separates independently evidenced effects inside one real-world event. */
  facetId: string;
  effectDirection: OntologyEffectDirection;
  severity: OntologySeverityDescriptor;
  evidenceIds: string[];
  rationale: string;
}

export interface OntologyCandidateLabel {
  categoryId: string;
  reason: string;
}

export interface PulseOntologyAnnotation {
  ontologyVersion: typeof PULSE_EVENT_ONTOLOGY_VERSION;
  disposition:
    | "qualifying_event"
    | "non_qualifying"
    | "insufficient_evidence";
  labels: OntologyLabelAssertion[];
  candidateLabels: OntologyCandidateLabel[];
  ambiguityReason: string | null;
}

const SAME_FACET_EXCLUSIVE_GROUPS = [
  ["fair_election", "flawed_election", "election_cancellation"],
  ["peaceful_transfer", "coup", "state_collapse"],
  ["judicial_independence_expansion", "judicial_independence_rollback"],
] as const;

const GENERIC_SPECIFIC_PAIRS = [
  ["emergency_declaration", "term_extension"],
  ["emergency_declaration", "mass_disenfranchisement"],
  ["emergency_declaration", "election_cancellation"],
  ["emergency_declaration", "constitutional_override_electoral"],
  ["emergency_declaration", "judicial_purge"],
  ["emergency_declaration", "martial_law"],
  ["systematic_crackdown", "ngo_restriction"],
  ["systematic_crackdown", "media_shutdown"],
  ["systematic_crackdown", "academic_freedom_change"],
  ["systematic_crackdown", "religious_freedom_change"],
  ["systematic_crackdown", "lgbt_rights_change"],
  ["systematic_crackdown", "minority_rights_change"],
  ["mass_detention", "opposition_prosecution"],
  ["mass_detention", "detention_conditions"],
  ["coup", "government_collapse"],
  ["coup", "constitutional_crisis"],
] as const;

function isSameFacetExclusive(left: string, right: string): boolean {
  return SAME_FACET_EXCLUSIVE_GROUPS.some(
    (group) => group.includes(left as never) && group.includes(right as never),
  );
}

function isGenericSpecificPair(left: string, right: string): boolean {
  return GENERIC_SPECIFIC_PAIRS.some(
    ([generic, specific]) =>
      (generic === left && specific === right) ||
      (generic === right && specific === left),
  );
}

export function labelAssertionsAreCompatible(
  left: OntologyLabelAssertion,
  right: OntologyLabelAssertion,
): boolean {
  if (left.facetId !== right.facetId) return true;
  if (left.categoryId === right.categoryId) return false;
  if (isSameFacetExclusive(left.categoryId, right.categoryId)) return false;
  if (isGenericSpecificPair(left.categoryId, right.categoryId)) return false;
  return true;
}

export const PULSE_EVENT_ONTOLOGY = Object.freeze({
  id: PULSE_EVENT_ONTOLOGY_VERSION,
  status: "adopted_research_codebook",
  adoptedOn: "2026-07-11",
  productionRuntime:
    "The scheduled classifier remains on taxonomy v2.0 until versioned row migration lands; new annotation and evaluation work uses this ontology.",
  dimensions: Object.freeze(
    PULSE_DIMENSIONS.map((id) =>
      Object.freeze({
        id,
        definition:
          id === "democratic_quality"
            ? "Electoral competition, participation, representation, and transfer of governing authority."
            : id === "rule_of_law"
              ? "Legal constraint, judicial and prosecutorial independence, lawful process, and institutional compliance."
              : id === "freedom_rights"
                ? "Civil, political, expressive, associational, movement, privacy, minority, and personal freedoms."
                : id === "corruption_control"
                  ? "Institutions and actions that expose, deter, prosecute, enable, or conceal abuse of public office for private gain."
                  : "Continuity or rupture of constitutional order, territorial control, peaceful succession, and organized political violence.",
      }),
    ),
  ),
  categories: Object.freeze(
    EVENT_CATEGORIES.map((category) =>
      Object.freeze({
        id: category.id,
        label: category.label,
        dimension: category.dimension,
        priorProductionDirection: category.direction,
        status: "carried_forward_concept",
      }),
    ),
  ),
  annotationContract: Object.freeze({
    maximumAssignedLabels: 5,
    dimensionDerivedFromCategory: true,
    effectDirectionSeparateFromOccurrence: true,
    severitySeparateFromNumericDelta: true,
    evidenceRequiredPerLabel: true,
    ambiguityUsesCandidateLabels: true,
  }),
  compatibilityRules: Object.freeze([
    "Multiple labels, including labels from different dimensions, may describe one event when each label has its own retained evidence and facet rationale.",
    "The same category cannot be asserted twice for the same facet.",
    "Mutually exclusive outcomes cannot be asserted for the same facet; uncertainty is stored as candidate labels instead.",
    "A generic and a more specific category cannot both label the same facet. Distinct independently evidenced facets may use both without double counting.",
    "A non-qualifying disposition carries no assigned or candidate labels. Insufficient evidence carries candidate labels but no assigned labels.",
  ]),
  ambiguityGuidance: Object.freeze([
    "Record event existence separately from its labels. A lawful or legitimate institutional act can be a qualifying occurrence without being coded as beneficial or harmful overall.",
    "When two labels remain plausible on the same evidence, assign neither; retain both as candidates with an ambiguity reason for adjudication.",
    "Do not infer a cascade. A coup does not itself prove martial law, media closure, electoral annulment, or detention; each additional label needs evidence of that additional occurrence facet.",
    "Effect direction is relative to the named construct, not a verdict on the country, government, policy, or event as a whole.",
    "Severity describes evidenced institutional scope and reversibility. It is not a probability, score delta, moral judgment, or country-quality band.",
  ]),
  changePolicy: Object.freeze({
    additive:
      "A new category requires a definition, dimension, source-framework rationale, example, counterexample, compatibility review, and a new ontology release.",
    breaking:
      "Changing a category identity, dimension, compatibility rule, severity definition, or annotation state requires a new major ontology version and migration map.",
    history:
      "Old annotations keep their original ontology version. New releases never relabel old rows silently.",
    production:
      "Classifier prompts, row schemas, review tools, APIs, and evaluation releases must name the exact ontology version before production can claim migration.",
  }),
} as const);

export function validatePulseOntologyAnnotation(
  annotation: PulseOntologyAnnotation,
): string[] {
  const errors: string[] = [];
  if (annotation.ontologyVersion !== PULSE_EVENT_ONTOLOGY_VERSION) {
    errors.push("ontology version is not current");
  }
  if (annotation.labels.length > PULSE_EVENT_ONTOLOGY.annotationContract.maximumAssignedLabels) {
    errors.push("too many assigned labels");
  }
  if (annotation.disposition === "qualifying_event" && annotation.labels.length === 0) {
    errors.push("qualifying events require at least one assigned label");
  }
  if (
    annotation.disposition === "non_qualifying" &&
    (annotation.labels.length > 0 || annotation.candidateLabels.length > 0)
  ) {
    errors.push("non-qualifying events cannot carry labels");
  }
  if (
    annotation.disposition === "insufficient_evidence" &&
    (annotation.labels.length > 0 || annotation.candidateLabels.length === 0)
  ) {
    errors.push("insufficient evidence requires candidates and no assigned labels");
  }
  if (
    annotation.disposition === "insufficient_evidence" &&
    !annotation.ambiguityReason?.trim()
  ) {
    errors.push("insufficient evidence requires an ambiguity reason");
  }

  for (const [index, label] of annotation.labels.entries()) {
    if (!EVENT_CATEGORY_INDEX[label.categoryId]) {
      errors.push(`label ${index} has an unknown category`);
    }
    if (!label.facetId.trim()) errors.push(`label ${index} has no facet id`);
    if (!label.evidenceIds.length)
      errors.push(`label ${index} has no evidence ids`);
    if (!label.rationale.trim()) errors.push(`label ${index} has no rationale`);
  }
  for (const [index, candidate] of annotation.candidateLabels.entries()) {
    if (!EVENT_CATEGORY_INDEX[candidate.categoryId]) {
      errors.push(`candidate ${index} has an unknown category`);
    }
    if (!candidate.reason.trim()) errors.push(`candidate ${index} has no reason`);
  }
  for (let left = 0; left < annotation.labels.length; left += 1) {
    for (let right = left + 1; right < annotation.labels.length; right += 1) {
      if (!labelAssertionsAreCompatible(annotation.labels[left], annotation.labels[right])) {
        errors.push(`labels ${left} and ${right} are incompatible on one facet`);
      }
    }
  }
  return errors;
}

const label = (
  categoryId: string,
  facetId: string,
  evidenceIds: string[],
  effectDirection: OntologyEffectDirection = "not_assessed",
  severity: OntologySeverityDescriptor = "not_assessed",
): OntologyLabelAssertion => ({
  categoryId,
  facetId,
  effectDirection,
  severity,
  evidenceIds,
  rationale: `Evidence supports ${categoryId} on facet ${facetId}.`,
});

export const PULSE_ONTOLOGY_FIXTURES = Object.freeze([
  Object.freeze({
    id: "multi-dimensional-coup-cascade",
    kind: "example",
    annotation: {
      ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
      disposition: "qualifying_event",
      labels: [
        label("coup", "power-seizure", ["source-coup"], "restrictive", "critical"),
        label(
          "constitutional_override_electoral",
          "electoral-mandate",
          ["source-dissolution"],
          "restrictive",
          "major",
        ),
        label(
          "media_shutdown",
          "media-access",
          ["source-media-order"],
          "restrictive",
          "material",
        ),
      ],
      candidateLabels: [],
      ambiguityReason: null,
    } satisfies PulseOntologyAnnotation,
    expectedErrors: 0,
  }),
  Object.freeze({
    id: "election-result-and-electoral-violence",
    kind: "example",
    annotation: {
      ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
      disposition: "qualifying_event",
      labels: [
        label("fair_election", "certified-result", ["observer-report"], "expansive", "material"),
        label("electoral_violence", "campaign-violence", ["violence-report"], "restrictive", "major"),
      ],
      candidateLabels: [],
      ambiguityReason: null,
    } satisfies PulseOntologyAnnotation,
    expectedErrors: 0,
  }),
  Object.freeze({
    id: "ambiguous-opposition-corruption-case",
    kind: "ambiguous_legitimate_event",
    annotation: {
      ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
      disposition: "insufficient_evidence",
      labels: [],
      candidateLabels: [
        {
          categoryId: "corruption_conviction",
          reason: "The judgment may reflect an independent corruption prosecution.",
        },
        {
          categoryId: "opposition_prosecution",
          reason: "The same record contains unresolved evidence of selective political prosecution.",
        },
      ],
      ambiguityReason:
        "Available evidence establishes the conviction but cannot resolve institutional independence.",
    } satisfies PulseOntologyAnnotation,
    expectedErrors: 0,
  }),
  Object.freeze({
    id: "lawful-disaster-emergency-without-governance-effect",
    kind: "counterexample",
    annotation: {
      ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
      disposition: "non_qualifying",
      labels: [],
      candidateLabels: [],
      ambiguityReason: null,
    } satisfies PulseOntologyAnnotation,
    expectedErrors: 0,
  }),
  Object.freeze({
    id: "generic-specific-double-label",
    kind: "counterexample",
    annotation: {
      ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
      disposition: "qualifying_event",
      labels: [
        label("emergency_declaration", "same-decree", ["decree"]),
        label("term_extension", "same-decree", ["decree"]),
      ],
      candidateLabels: [],
      ambiguityReason: null,
    } satisfies PulseOntologyAnnotation,
    expectedErrors: 1,
  }),
  Object.freeze({
    id: "unsupported-inferred-cascade",
    kind: "counterexample",
    annotation: {
      ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
      disposition: "qualifying_event",
      labels: [
        label("coup", "power-seizure", ["coup-report"]),
        label("martial_law", "military-jurisdiction", []),
      ],
      candidateLabels: [],
      ambiguityReason: null,
    } satisfies PulseOntologyAnnotation,
    expectedErrors: 1,
  }),
] as const);

export function ontologyCategoryDimension(categoryId: string): PulseDimension | null {
  return EVENT_CATEGORY_INDEX[categoryId]?.dimension ?? null;
}

export function priorProductionDirection(categoryId: string): EventDirection | null {
  return EVENT_CATEGORY_INDEX[categoryId]?.direction ?? null;
}
