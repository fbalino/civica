/**
 * ATL-019 — `fact` entity citation resolver.
 *
 * Backing table: `country_facts` (one row per jurisdiction × fact-key ×
 * source observation). The stable id is `country_facts.id` (UUID primary
 * key) — never `fact_value` or the jurisdiction's display name.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { countryFacts, jurisdictions } from "@/lib/db/schema";
import { getFactKey } from "@/lib/factbook/reconcile/fact-keys";
import { absoluteUrl } from "@/lib/site";
import {
  STABLE_ENTITY_CITATION_SCHEMA_VERSION,
  buildCitationUrl,
  type EntityCitationSource,
  type FactCitation,
} from "@/lib/citations/stable-identity";
import { fetchSourceCitation, nowIso, toIsoOrNull } from "./shared";

export interface FactCitationRow {
  id: string;
  jurisdictionSlug: string;
  jurisdictionName: string;
  factKey: string;
  sourceId: string | null;
  sourceUrl: string | null;
  asOf: string | null;
  upstreamVintageLabel: string | null;
  retrievedAt: Date | string | null;
}

/** Pure — no DB access. Row + already-fetched source in, citation out. */
export function buildFactCitation(
  row: FactCitationRow,
  source: EntityCitationSource,
  resolvedAt: string = nowIso(),
): FactCitation {
  const factLabel = getFactKey(row.factKey)?.label ?? row.factKey;
  const resolvedSource: EntityCitationSource = row.sourceUrl
    ? { ...source, sourceUrl: row.sourceUrl }
    : source;
  return {
    schemaVersion: STABLE_ENTITY_CITATION_SCHEMA_VERSION,
    entityType: "fact",
    id: row.id,
    label: `${row.jurisdictionName} — ${factLabel}`,
    citationUrl: buildCitationUrl("fact", row.id),
    readerUrl: absoluteUrl(
      `/country/${encodeURIComponent(row.jurisdictionSlug)}`,
    ),
    source: resolvedSource,
    jurisdictionSlug: row.jurisdictionSlug,
    jurisdictionName: row.jurisdictionName,
    factKey: row.factKey,
    vintage: {
      asOf: row.asOf ?? null,
      upstreamVintageLabel: row.upstreamVintageLabel ?? null,
      retrievedAt: toIsoOrNull(row.retrievedAt),
    },
    resolvedAt,
  };
}

export async function resolveFactCitation(
  id: string,
): Promise<FactCitation | null> {
  const rows = await db
    .select({
      id: countryFacts.id,
      jurisdictionSlug: jurisdictions.slug,
      jurisdictionName: jurisdictions.name,
      factKey: countryFacts.factKey,
      sourceId: countryFacts.sourceId,
      sourceUrl: countryFacts.sourceUrl,
      asOf: countryFacts.asOf,
      upstreamVintageLabel: countryFacts.upstreamVintageLabel,
      retrievedAt: countryFacts.retrievedAt,
    })
    .from(countryFacts)
    .innerJoin(jurisdictions, eq(countryFacts.jurisdictionId, jurisdictions.id))
    .where(eq(countryFacts.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const source = await fetchSourceCitation(row.sourceId);
  return buildFactCitation(row, source);
}
