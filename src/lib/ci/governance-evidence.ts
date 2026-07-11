import { K1_UNCERTAINTY_INPUTS } from "./k1-uncertainty-inputs";
import { sourceRights } from "@/lib/rights/manifest";

export const GOVERNANCE_EVIDENCE_RELEASE_ID = K1_UNCERTAINTY_INPUTS.releaseId;
export const GOVERNANCE_EVIDENCE_YEAR = K1_UNCERTAINTY_INPUTS.referenceYear;

export const GOVERNANCE_EVIDENCE_INDICATORS = Object.freeze([
  { identity: "vdem:v2x_libdem", sourceId: "vdem", indicatorId: "v2x_libdem", label: "Liberal Democracy Index", construct: "Electoral democracy, liberal constraints, civil liberties, rule of law, and checks on executive power", direction: "Higher values indicate more liberal-democratic institutions under V-Dem's model", sourceUrl: K1_UNCERTAINTY_INPUTS.captures.vdem.url },
  { identity: "worldbank_wgi:va.est", sourceId: "worldbank_wgi", indicatorId: "va.est", label: "Voice and Accountability", construct: "Participation in selecting government, expression, association, and free media", direction: "Higher estimates indicate stronger voice and accountability under WGI", sourceUrl: K1_UNCERTAINTY_INPUTS.captures.wgi.url },
  { identity: "worldbank_wgi:rl.est", sourceId: "worldbank_wgi", indicatorId: "rl.est", label: "Rule of Law", construct: "Confidence in and adherence to rules, including contract enforcement, property rights, police, courts, crime, and violence", direction: "Higher estimates indicate stronger rule of law under WGI", sourceUrl: K1_UNCERTAINTY_INPUTS.captures.wgi.url },
  { identity: "freedom_house:pr_cl_total", sourceId: "freedom_house", indicatorId: "pr_cl_total", label: "Freedom in the World combined rating", construct: "Political rights and civil liberties ratings under Freedom House's methodology", direction: "Lower combined ratings indicate greater political rights and civil liberties; 2 is the freest endpoint and 14 the least free", sourceUrl: K1_UNCERTAINTY_INPUTS.captures.freedomHouse.url },
  { identity: "transparency_intl:score", sourceId: "transparency_intl", indicatorId: "score", label: "Corruption Perceptions Index", construct: "Perceived public-sector corruption according to expert and business sources", direction: "Higher scores indicate lower perceived public-sector corruption", sourceUrl: K1_UNCERTAINTY_INPUTS.captures.cpi.url },
] as const);

export type GovernanceEvidenceRow = {
  sourceId: string;
  sourceOwner: string;
  indicatorId: string;
  label: string;
  construct: string;
  direction: string;
  value: number | null;
  valueStatus: string;
  missingReason: string | null;
  nativeUnit: string;
  nativeMin: number;
  nativeMax: number;
  uncertaintyLower: number | null;
  uncertaintyUpper: number | null;
  uncertaintyStatus: string;
  sourceVintage: string;
  seriesType: string;
  artifactHash: string;
  sourceUrl: string;
  lastSyncAt: string | null;
  exportPermission: string;
  termsUrl: string;
};

export function governanceEvidenceMeta(sourceId: string, indicatorId: string) {
  return GOVERNANCE_EVIDENCE_INDICATORS.find((row) => row.sourceId === sourceId && row.indicatorId === indicatorId);
}

export function governanceEvidenceRights(sourceId: string) {
  const rights = sourceRights(sourceId);
  return {
    exportPermission: rights?.publicExport ?? "pending-review",
    termsUrl: rights?.termsUrl ?? "/licensing#rights-manifest",
  };
}

export function formatNativeEvidenceValue(value: number, nativeMin: number, nativeMax: number) {
  const span = nativeMax - nativeMin;
  return span <= 1 ? value.toFixed(3) : span <= 10 ? value.toFixed(2) : value.toFixed(1);
}

const UNCERTAINTY_STATUS_LABELS: Record<string, string> = {
  publisher_credible_region: "Publisher credible region",
  publisher_90pct_interval: "Publisher 90% interval",
  publisher_confidence_interval: "Publisher confidence interval",
  no_per_country_probability_distribution_published: "No per-country probability distribution published",
};

export function formatUncertaintyStatus(status: string) {
  return UNCERTAINTY_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export function buildGovernanceEvidenceExport(evidence: { country: { slug: string }; year: number; releaseId: string; rows: GovernanceEvidenceRow[] }) {
  return {
    schemaVersion: "governance-evidence-export/v1",
    ...evidence,
    rows: evidence.rows.map((row) => row.exportPermission === "allowed" ? row : { ...row, value: null, uncertaintyLower: null, uncertaintyUpper: null, valueStatus: "withheld", missingReason: "Civica bulk redistribution is blocked pending or under publisher terms; use sourceUrl." }),
    notice: "Only observations with verified public-export permission retain values. Withheld rows link to the exact publisher file.",
  };
}
