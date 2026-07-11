import { researchPanelHash } from "./research-panel";

export const K3_LEDGER_METHOD_VERSION = "k3-power-transfer-ledger/v1";
export const K3_LEDGER_AS_OF = "2026-07-11";

export const K3_LEDGER_CONTRACT = Object.freeze({
  candidateId: "K3" as const,
  methodVersion: K3_LEDGER_METHOD_VERSION,
  unit: "sourced current executive state; later releases add separately sourced transfer events",
  chiefExecutiveRules: {
    cabinetAndCeremonialMonarchy: "head_of_government",
    singleExecutive: "one sourced person across executive roles; otherwise contested",
    collectiveExecutive: "contested until a collective-office coding rule is validated",
    unknownOrDual: "one sourced person across executive roles or contested",
  },
  alternationRule: "Different person and governing party or coalition, directly resulting from a verified election; both predecessor history and election linkage are required.",
  coalitionRule: "A renamed or reconfigured coalition is the same governing group only when a versioned membership crosswalk proves continuity; otherwise contested.",
  indirectElectionRule: "Eligible only when the constitutionally authorized electoral body selected the executive and the source links that vote to the term.",
  interimRule: "Interim, acting, caretaker, de facto, and disputed claimants never establish electoral alternation without separate adjudication.",
  tenureRule: "Calendar days from sourced term start to the fixed release as-of date; unknown start means no tenure value.",
  termLimitRule: "Requires sourced constitutional rule, office scope, amendment history, prior completed terms, and an adjudicated current-term count.",
  nonclaims: ["alternation is neither necessary nor sufficient for democracy", "long tenure is not autocracy", "formal term-limit status is not compliance in practice", "no country-quality score or rank"],
  currentPrototypeLimits: ["no term end dates", "no predecessor chain", "no validated election-to-term links", "no coded term-limit states"],
  validation: { intercoderAlpha: 0.8, citationAuditRows: 100, citationVerifiability: 0.98, historicalAgreement: 0.95, freshnessDays: 14, freshnessShare: 0.9, freshnessQuarters: 2 },
});

export interface K3Citation { sourceId: string; sourceUrl: string; sourceHash: string | null; sourceLicense: string | null; retrievedAt: string; predicate: string }
export interface K3TermInput { iso3: string; jurisdictionId: string; executiveStructure: string; termId: string; officeType: "head_of_state" | "head_of_government"; officeName: string; personId: string; personName: string; partyName: string | null; startDate: string | null; citations: readonly K3Citation[] }
export interface K3LedgerOutput { candidateId: "K3"; unitId: string; iso3: string; asOf: typeof K3_LEDGER_AS_OF; executiveIdentityStatus: "observed" | "contested"; executive: null | { personId: string; personName: string; officeType: string; officeName: string; partyName: string | null; startDate: string; tenureDays: number }; contestedCandidates: readonly { personId: string; personName: string; officeType: string }[]; latestElectoralTransfer: { state: "not_computable"; reason: "no_predecessor_history_or_election_linkage" }; termLimitStatus: { state: "unknown"; reason: "constitutional_rule_and_prior_terms_not_coded" }; citations: readonly K3Citation[]; methodVersion: typeof K3_LEDGER_METHOD_VERSION }

const CABINET_STRUCTURES = new Set(["cabinet_executive", "monarchic_head_of_state", "dual_monarchic_head_of_state"]);
const COLLECTIVE_STRUCTURES = new Set(["collegial_head_of_state", "collegial_executive", "military_council"]);
function daysBetween(start: string, end: string): number { return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000); }
function uniqueTerms(rows: readonly K3TermInput[]): K3TermInput[] {
  const map = new Map<string, K3TermInput>();
  for (const row of rows) { const key = `${row.personId}:${row.officeType}:${row.startDate}`; const prior = map.get(key); map.set(key, prior ? { ...prior, citations: [...new Map([...prior.citations, ...row.citations].map((citation) => [`${citation.sourceId}:${citation.predicate}:${citation.sourceUrl}`, citation])).values()] } : row); }
  return [...map.values()];
}

export function runK3LedgerPrototype(rows: readonly K3TermInput[]): K3LedgerOutput[] {
  const groups = new Map<string, K3TermInput[]>(); for (const row of rows) groups.set(row.iso3, [...(groups.get(row.iso3) ?? []), row]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([iso3, raw]) => {
    const eligible = uniqueTerms(raw).filter((row) => row.startDate && row.citations.some((citation) => citation.sourceUrl));
    if (eligible.length === 0) return [];
    const structure = eligible[0].executiveStructure; let candidates = eligible;
    if (CABINET_STRUCTURES.has(structure)) candidates = eligible.filter((row) => row.officeType === "head_of_government");
    const people = new Set(candidates.map((row) => row.personId));
    const collective = COLLECTIVE_STRUCTURES.has(structure);
    const selected = !collective && people.size === 1 ? candidates.sort((a, b) => a.officeType.localeCompare(b.officeType))[0] : null;
    const citations = [...new Map(candidates.flatMap((row) => row.citations).map((citation) => [`${citation.sourceId}:${citation.predicate}:${citation.sourceUrl}`, citation])).values()];
    if (citations.length === 0) return [];
    return [{ candidateId: "K3" as const, unitId: `${iso3}:${K3_LEDGER_AS_OF}`, iso3, asOf: K3_LEDGER_AS_OF,
      executiveIdentityStatus: selected ? "observed" as const : "contested" as const,
      executive: selected ? { personId: selected.personId, personName: selected.personName, officeType: selected.officeType, officeName: selected.officeName, partyName: selected.partyName, startDate: selected.startDate!, tenureDays: daysBetween(selected.startDate!, K3_LEDGER_AS_OF) } : null,
      contestedCandidates: selected ? [] : candidates.map((row) => ({ personId: row.personId, personName: row.personName, officeType: row.officeType })),
      latestElectoralTransfer: { state: "not_computable" as const, reason: "no_predecessor_history_or_election_linkage" as const },
      termLimitStatus: { state: "unknown" as const, reason: "constitutional_rule_and_prior_terms_not_coded" as const }, citations, methodVersion: K3_LEDGER_METHOD_VERSION }];
  });
}

export function k3LedgerErrors(outputs: readonly K3LedgerOutput[]): string[] {
  const errors: string[] = []; for (const row of outputs) { if (row.citations.length === 0 || row.citations.some((citation) => !citation.sourceUrl)) errors.push(`${row.iso3} lacks statement citation`); if (row.executive && row.executive.tenureDays < 0) errors.push(`${row.iso3} has future tenure`); if ((row as unknown as Record<string, unknown>).score !== undefined || (row as unknown as Record<string, unknown>).rank !== undefined) errors.push(`${row.iso3} has prohibited aggregate`); }
  return errors;
}

export function k3LedgerHash(outputs: readonly K3LedgerOutput[]): string { return researchPanelHash(outputs); }
