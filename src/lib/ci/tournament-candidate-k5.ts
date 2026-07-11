import { geographicTournamentBucket } from "./tournament-preregistration";
import { researchPanelHash } from "./research-panel";

export const K5_RELATION_METHOD_VERSION = "k5-institutional-constraint-map/v1" as const;

export type K5RelationType = "appoints_or_selects" | "removes" | "approves_or_vetoes_legislation" | "overrides_veto" | "dismisses_legislature" | "constitutional_review" | "emergency_power";
export type K5InstitutionType = "head_of_state" | "head_of_government" | "cabinet" | "legislature" | "constitutional_court" | "judiciary" | "unspecified_institution" | "constitutional_order";

/** Topic tags nominate passages only. Source/target endpoints remain unknown unless the topic semantics name them. */
export const K5_RELATION_TAXONOMY = Object.freeze([
  Object.freeze({ topicKey: "cabsel", relationType: "appoints_or_selects", sourceType: "unspecified_institution", targetType: "cabinet" }),
  Object.freeze({ topicKey: "consel", relationType: "appoints_or_selects", sourceType: "unspecified_institution", targetType: "constitutional_court" }),
  Object.freeze({ topicKey: "cabdiss", relationType: "removes", sourceType: "unspecified_institution", targetType: "cabinet" }),
  Object.freeze({ topicKey: "conrem", relationType: "removes", sourceType: "unspecified_institution", targetType: "constitutional_court" }),
  Object.freeze({ topicKey: "hogdiss", relationType: "removes", sourceType: "unspecified_institution", targetType: "head_of_government" }),
  Object.freeze({ topicKey: "hosdiss", relationType: "removes", sourceType: "unspecified_institution", targetType: "head_of_state" }),
  Object.freeze({ topicKey: "jrem", relationType: "removes", sourceType: "unspecified_institution", targetType: "judiciary" }),
  Object.freeze({ topicKey: "legapp", relationType: "approves_or_vetoes_legislation", sourceType: "unspecified_institution", targetType: "legislature" }),
  Object.freeze({ topicKey: "override", relationType: "overrides_veto", sourceType: "legislature", targetType: "unspecified_institution" }),
  Object.freeze({ topicKey: "legdiss", relationType: "dismisses_legislature", sourceType: "unspecified_institution", targetType: "legislature" }),
  Object.freeze({ topicKey: "conpow", relationType: "constitutional_review", sourceType: "constitutional_court", targetType: "constitutional_order" }),
  Object.freeze({ topicKey: "em", relationType: "emergency_power", sourceType: "unspecified_institution", targetType: "constitutional_order" }),
] as const satisfies readonly { topicKey: string; relationType: K5RelationType; sourceType: K5InstitutionType; targetType: K5InstitutionType }[]);

export const K5_RELATION_CONTRACT = Object.freeze({
  candidateId: "K5" as const, methodVersion: K5_RELATION_METHOD_VERSION,
  unit: "candidate constitutional passage for one directed formal institution relation",
  relationTaxonomy: K5_RELATION_TAXONOMY,
  codingState: "candidate_topic_match_pending_double_blind_relation_coding",
  endpointRule: "An unspecified endpoint remains unspecified until a blinded coder identifies a named institution in the passage; it is never inferred from country form.",
  unknownRule: "No matching passage or no coded endpoint means unknown, never absence of formal power.",
  graphRule: "Only independently coded and adjudicated relations can become graph edges; candidate topic matches are not edges.",
  prohibitions: ["no weighted relation total", "no country-quality score", "no democracy inference", "no claim that more constraints are better", "no ranking or traffic-light summary"],
  validation: { krippendorffAlpha: 0.8, blindedExpertRelations: 30, expertFairShare: 0.8, citationAuditRelations: 100, citationVerifiability: 0.98 },
});

export interface K5ExcerptInput { jurisdictionId: string; iso3: string; constitutionId: string; constitutionYear: number | null; constituteProjectId: string | null; topicKey: string; topicLabel: string; sectionId: string | null; articleLabel: string | null; excerptHtml: string }
export interface K5RelationCandidate { candidateId: "K5"; unitId: string; jurisdictionId: string; iso3: string; split: "development" | "validation" | "final_holdout"; constitutionalVintage: number | null; relationType: K5RelationType; sourceTypeCandidate: K5InstitutionType; targetTypeCandidate: K5InstitutionType; endpointState: "pending_blinded_coding"; codingState: "candidate_topic_match_pending_double_blind_relation_coding"; evidence: { constitutionId: string; constituteProjectId: string | null; topicKey: string; topicLabel: string; sectionId: string | null; articleLabel: string | null; excerptHtml: string }; methodVersion: typeof K5_RELATION_METHOD_VERSION }

function geographicSplit(iso3: string): K5RelationCandidate["split"] { const bucket = geographicTournamentBucket(iso3); return bucket <= 6 ? "development" : bucket <= 8 ? "validation" : "final_holdout"; }

export function runK5RelationCandidateExtraction(excerpts: readonly K5ExcerptInput[]): K5RelationCandidate[] {
  const taxonomy = new Map<string, (typeof K5_RELATION_TAXONOMY)[number]>(K5_RELATION_TAXONOMY.map((row) => [row.topicKey, row]));
  return excerpts.flatMap((excerpt) => {
    const rule = taxonomy.get(excerpt.topicKey); if (!rule) return [];
    const evidence = { constitutionId: excerpt.constitutionId, constituteProjectId: excerpt.constituteProjectId, topicKey: excerpt.topicKey, topicLabel: excerpt.topicLabel, sectionId: excerpt.sectionId, articleLabel: excerpt.articleLabel, excerptHtml: excerpt.excerptHtml };
    return [{ candidateId: "K5" as const, unitId: researchPanelHash({ jurisdictionId: excerpt.jurisdictionId, ...evidence }), jurisdictionId: excerpt.jurisdictionId, iso3: excerpt.iso3, split: geographicSplit(excerpt.iso3), constitutionalVintage: excerpt.constitutionYear, relationType: rule.relationType, sourceTypeCandidate: rule.sourceType, targetTypeCandidate: rule.targetType, endpointState: "pending_blinded_coding" as const, codingState: "candidate_topic_match_pending_double_blind_relation_coding" as const, evidence, methodVersion: K5_RELATION_METHOD_VERSION }];
  }).sort((a, b) => a.unitId.localeCompare(b.unitId));
}

export function k5RelationErrors(rows: readonly K5RelationCandidate[]): string[] { const errors: string[] = []; for (const row of rows) { const unsafe = row as unknown as Record<string, unknown>; for (const field of ["score", "rank", "grade", "weightedTotal", "quality", "constraintCount"]) if (unsafe[field] !== undefined) errors.push(`${row.unitId} has prohibited ${field}`); if (!row.evidence.excerptHtml || !row.evidence.topicKey) errors.push(`${row.unitId} lacks passage evidence`); if (row.endpointState !== "pending_blinded_coding") errors.push(`${row.unitId} prematurely asserts an edge`); } return errors; }
export function k5RelationHash(rows: readonly K5RelationCandidate[]): string { return researchPanelHash(rows); }
