import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import { ciResearchPanelRows, jurisdictions, sources } from "./schema";
import { GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES, GOVERNANCE_EVIDENCE_INDICATORS, GOVERNANCE_EVIDENCE_RELEASE_ID, GOVERNANCE_EVIDENCE_SERIES, GOVERNANCE_EVIDENCE_YEAR, governanceEvidenceMeta, governanceEvidenceRights, type GovernanceEvidenceRow } from "@/lib/ci/governance-evidence";
import { normalizeCiSeriesType, type CiSeriesType } from "@/lib/ci/series-provenance";

export async function getGovernanceEvidenceCountries() {
  return db.select({ slug: jurisdictions.slug, name: jurisdictions.name, iso2: jurisdictions.iso2, iso3: jurisdictions.iso3, capital: jurisdictions.capital, continent: jurisdictions.continent })
    .from(jurisdictions)
    .where(eq(jurisdictions.type, "sovereign_state"))
    .orderBy(asc(jurisdictions.name));
}

export async function getGovernanceEvidence(
  slug: string,
  requestedSeriesType: CiSeriesType = GOVERNANCE_EVIDENCE_SERIES.seriesType,
) {
  if (!GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES.includes(requestedSeriesType)) return null;
  const [country] = await db.select({ id: jurisdictions.id, slug: jurisdictions.slug, name: jurisdictions.name, iso2: jurisdictions.iso2, iso3: jurisdictions.iso3 })
    .from(jurisdictions).where(and(eq(jurisdictions.slug, slug), eq(jurisdictions.type, "sovereign_state"))).limit(1);
  if (!country) return null;
  const raw = await db.select({ sourceId: ciResearchPanelRows.sourceId, sourceOwner: ciResearchPanelRows.sourceOwner, indicatorId: ciResearchPanelRows.indicatorId, value: ciResearchPanelRows.value, valueStatus: ciResearchPanelRows.availabilityStatus, missingReason: ciResearchPanelRows.missingReason, nativeUnit: ciResearchPanelRows.nativeUnit, nativeMin: ciResearchPanelRows.nativeMin, nativeMax: ciResearchPanelRows.nativeMax, uncertaintyLower: ciResearchPanelRows.uncertaintyLower, uncertaintyUpper: ciResearchPanelRows.uncertaintyUpper, uncertaintyStatus: ciResearchPanelRows.uncertaintyStatus, sourceVintage: ciResearchPanelRows.sourceVintage, seriesType: ciResearchPanelRows.seriesType, artifactHash: ciResearchPanelRows.artifactHash, lastSyncAt: sources.lastSyncAt })
    .from(ciResearchPanelRows).leftJoin(sources, eq(ciResearchPanelRows.sourceId, sources.id))
    .where(and(eq(ciResearchPanelRows.releaseId, GOVERNANCE_EVIDENCE_RELEASE_ID), eq(ciResearchPanelRows.jurisdictionId, country.id), eq(ciResearchPanelRows.periodYear, GOVERNANCE_EVIDENCE_YEAR)))
    .orderBy(asc(ciResearchPanelRows.sourceId), asc(ciResearchPanelRows.indicatorId));
  const rows = raw.flatMap((row): GovernanceEvidenceRow[] => {
    const meta = governanceEvidenceMeta(row.sourceId, row.indicatorId);
    if (!meta) return [];
    const rights = governanceEvidenceRights(row.sourceId);
    const seriesType = normalizeCiSeriesType(row.seriesType);
    if (seriesType !== requestedSeriesType) return [];
    return [{ ...row, seriesType, label: meta.label, construct: meta.construct, direction: meta.direction, sourceUrl: meta.sourceUrl, lastSyncAt: row.lastSyncAt?.toISOString() ?? null, ...rights }];
  });
  const order = new Map<string, number>(GOVERNANCE_EVIDENCE_INDICATORS.map((row, index) => [row.identity, index]));
  rows.sort((a, b) => (order.get(`${a.sourceId}:${a.indicatorId}`) ?? 99) - (order.get(`${b.sourceId}:${b.indicatorId}`) ?? 99));
  return {
    country,
    year: GOVERNANCE_EVIDENCE_YEAR,
    releaseId: GOVERNANCE_EVIDENCE_RELEASE_ID,
    series: GOVERNANCE_EVIDENCE_SERIES,
    availableSeriesTypes: GOVERNANCE_EVIDENCE_AVAILABLE_SERIES_TYPES,
    rows,
  };
}
