import { K4_PRACTICE_INDICATORS } from "./k4-practice-inputs";
import { researchPanelHash } from "./research-panel";
import { geographicTournamentBucket } from "./tournament-preregistration";

export const K4_PAIRING_METHOD_VERSION = "k4-constitution-practice-pairings/v1" as const;
export const K4_PAIRING_YEAR = 2024 as const;

export const K4_PAIRING_CONTRACT = Object.freeze({
  candidateId: "K4" as const,
  methodVersion: K4_PAIRING_METHOD_VERSION,
  unit: "jurisdiction × preregistered constitutional-practice construct at one frozen practice year",
  constitutionalCodingState: "candidate_topic_match_pending_blinded_human_coding",
  mappingRules: K4_PRACTICE_INDICATORS.map((row) => ({ constructId: row.constructId, topicKeys: row.constitutionalTopicKeys, practiceIndicatorId: row.indicatorId, semanticLimit: row.semanticLimit })),
  prohibitions: ["no subtraction of text presence from practice value", "no hypocrisy or gap label", "no aggregation across constructs", "no country score, grade, rank, tier, or traffic light"],
  validation: { independentCoders: 2, krippendorffAlpha: 0.8, scholarFairnessShare: 0.9, adjudicationAfterBlindScoring: true },
});

export interface K4ExcerptInput { jurisdictionId: string; iso3: string; constitutionId: string; constitutionYear: number | null; constituteProjectId: string | null; topicKey: string; topicLabel: string; sectionId: string | null; articleLabel: string | null; excerptHtml: string }
export interface K4PracticeInput { jurisdictionId: string; iso3: string; periodYear: number; indicatorId: string; value: number | null; uncertaintyLower: number | null; uncertaintyUpper: number | null; missingReason: string | null; sourceVintage: string; artifactHash: string }
export interface K4PairingOutput {
  candidateId: "K4"; unitId: string; jurisdictionId: string; iso3: string; split: "development" | "validation" | "final_holdout"; constructId: string; practiceYear: number;
  constitutionalEvidence: { codingState: "candidate_topic_match_pending_blinded_human_coding" | "no_tagged_excerpt"; excerpts: readonly { constitutionId: string; constitutionYear: number | null; constituteProjectId: string | null; topicKey: string; topicLabel: string; sectionId: string | null; articleLabel: string | null; excerptHtml: string }[] };
  practiceEvidence: { indicatorId: string; sourceVintage: string; artifactHash: string; value: number | null; uncertaintyLower: number | null; uncertaintyUpper: number | null; missingReason: string | null };
  interpretationState: "not_scored_pending_blinded_coding_and_scholar_review"; methodVersion: typeof K4_PAIRING_METHOD_VERSION;
}

export function runK4PairingPrototype(excerpts: readonly K4ExcerptInput[], practice: readonly K4PracticeInput[]): K4PairingOutput[] {
  const excerptGroups = new Map<string, K4ExcerptInput[]>();
  for (const excerpt of excerpts) {
    const indicator = K4_PRACTICE_INDICATORS.find((row) => (row.constitutionalTopicKeys as readonly string[]).includes(excerpt.topicKey));
    if (!indicator) continue;
    const key = `${excerpt.jurisdictionId}:${indicator.constructId}`;
    excerptGroups.set(key, [...(excerptGroups.get(key) ?? []), excerpt]);
  }
  const practiceByKey = new Map(practice.map((row) => [`${row.jurisdictionId}:${row.indicatorId}`, row]));
  const jurisdictions = [...new Map(practice.map((row) => [row.jurisdictionId, row.iso3])).entries()];
  return jurisdictions.flatMap(([jurisdictionId, iso3]) => K4_PRACTICE_INDICATORS.map((indicator) => {
    const matched = (excerptGroups.get(`${jurisdictionId}:${indicator.constructId}`) ?? []).sort((a, b) => `${a.topicKey}:${a.sectionId ?? ""}`.localeCompare(`${b.topicKey}:${b.sectionId ?? ""}`));
    const observed = practiceByKey.get(`${jurisdictionId}:${indicator.indicatorId}`);
    return {
      candidateId: "K4" as const, unitId: `${iso3}:${indicator.constructId}:${K4_PAIRING_YEAR}`, jurisdictionId, iso3, split: geographicTournamentBucket(iso3) <= 6 ? "development" as const : geographicTournamentBucket(iso3) <= 8 ? "validation" as const : "final_holdout" as const, constructId: indicator.constructId, practiceYear: K4_PAIRING_YEAR,
      constitutionalEvidence: { codingState: matched.length ? "candidate_topic_match_pending_blinded_human_coding" as const : "no_tagged_excerpt" as const, excerpts: matched.map(({ jurisdictionId: _, iso3: __, ...row }) => row) },
      practiceEvidence: { indicatorId: indicator.indicatorId, sourceVintage: observed?.sourceVintage ?? "V-Dem Country-Year Core v15", artifactHash: observed?.artifactHash ?? "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b", value: observed?.value ?? null, uncertaintyLower: observed?.uncertaintyLower ?? null, uncertaintyUpper: observed?.uncertaintyUpper ?? null, missingReason: observed?.missingReason ?? "source_no_observation_for_jurisdiction_period" },
      interpretationState: "not_scored_pending_blinded_coding_and_scholar_review" as const, methodVersion: K4_PAIRING_METHOD_VERSION,
    };
  })).sort((a, b) => a.unitId.localeCompare(b.unitId));
}

export function k4PairingErrors(outputs: readonly K4PairingOutput[]): string[] {
  const errors: string[] = [];
  for (const row of outputs) {
    const unsafe = row as unknown as Record<string, unknown>;
    for (const field of ["score", "rank", "grade", "gap", "tier", "hypocrisy"]) if (unsafe[field] !== undefined) errors.push(`${row.unitId} has prohibited ${field}`);
    const p = row.practiceEvidence;
    if (p.value !== null && (p.uncertaintyLower === null || p.uncertaintyUpper === null)) errors.push(`${row.unitId} drops publisher uncertainty`);
    if (row.constitutionalEvidence.codingState === "candidate_topic_match_pending_blinded_human_coding" && row.constitutionalEvidence.excerpts.length === 0) errors.push(`${row.unitId} has empty candidate coding state`);
  }
  return errors;
}

export function k4PairingHash(outputs: readonly K4PairingOutput[]): string { return researchPanelHash(outputs); }
