/**
 * ATL-019 — `indicator` entity citation resolver.
 *
 * Backing table: `country_metrics` (one row per jurisdiction × metric ×
 * year). The stable id is `country_metrics.id` (UUID primary key) — never
 * `metric_definitions.name`, the human label, which can be re-worded
 * without the observation ceasing to be the same citable data point.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { countryMetrics, jurisdictions, metricDefinitions } from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/site";
import {
  STABLE_ENTITY_CITATION_SCHEMA_VERSION,
  buildCitationUrl,
  type EntityCitationSource,
  type IndicatorCitation,
} from "@/lib/citations/stable-identity";
import { fetchSourceCitation, nowIso, toIsoOrNull } from "./shared";

export interface IndicatorCitationRow {
  id: string;
  jurisdictionSlug: string;
  jurisdictionName: string;
  metricId: string;
  metricName: string;
  year: number;
  sourceId: string;
  sourceUrl: string | null;
  createdAt: Date | string | null;
}

/** Pure — no DB access. */
export function buildIndicatorCitation(
  row: IndicatorCitationRow,
  source: EntityCitationSource,
  resolvedAt: string = nowIso(),
): IndicatorCitation {
  const resolvedSource: EntityCitationSource = row.sourceUrl
    ? { ...source, sourceUrl: row.sourceUrl }
    : source;
  return {
    schemaVersion: STABLE_ENTITY_CITATION_SCHEMA_VERSION,
    entityType: "indicator",
    id: row.id,
    label: `${row.jurisdictionName} — ${row.metricName} (${row.year})`,
    citationUrl: buildCitationUrl("indicator", row.id),
    readerUrl: absoluteUrl(
      `/country/${encodeURIComponent(row.jurisdictionSlug)}/civica-data`,
    ),
    source: resolvedSource,
    jurisdictionSlug: row.jurisdictionSlug,
    jurisdictionName: row.jurisdictionName,
    metricId: row.metricId,
    year: row.year,
    vintage: {
      asOf: null,
      upstreamVintageLabel: null,
      retrievedAt: toIsoOrNull(row.createdAt),
    },
    resolvedAt,
  };
}

export async function resolveIndicatorCitation(
  id: string,
): Promise<IndicatorCitation | null> {
  const rows = await db
    .select({
      id: countryMetrics.id,
      jurisdictionSlug: jurisdictions.slug,
      jurisdictionName: jurisdictions.name,
      metricId: countryMetrics.metricId,
      metricName: metricDefinitions.name,
      year: countryMetrics.year,
      sourceId: countryMetrics.sourceId,
      sourceUrl: countryMetrics.sourceUrl,
      createdAt: countryMetrics.createdAt,
    })
    .from(countryMetrics)
    .innerJoin(jurisdictions, eq(countryMetrics.jurisdictionId, jurisdictions.id))
    .innerJoin(metricDefinitions, eq(countryMetrics.metricId, metricDefinitions.id))
    .where(eq(countryMetrics.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const source = await fetchSourceCitation(row.sourceId);
  return buildIndicatorCitation(row, source);
}
