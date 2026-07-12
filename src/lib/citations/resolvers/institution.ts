/**
 * ATL-019 — `institution` entity citation resolver.
 *
 * Backing table: `government_bodies`. The stable id is
 * `government_bodies.id` (UUID primary key) — never the body's `name`,
 * which is display text and can be corrected/retranslated.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { governmentBodies, jurisdictions } from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/site";
import {
  STABLE_ENTITY_CITATION_SCHEMA_VERSION,
  buildCitationUrl,
  deriveHeuristicSourceId,
  type EntityCitationSource,
  type EntityRevisionRelease,
  type InstitutionCitation,
} from "@/lib/citations/stable-identity";
import { fetchRevisionRelease, fetchSourceCitation, nowIso } from "./shared";

export interface InstitutionCitationRow {
  id: string;
  jurisdictionSlug: string;
  jurisdictionName: string;
  name: string;
  bodyType: string;
  ipuParlineId: string | null;
  wikidataQid: string | null;
}

/** Pure — no DB access. */
export function buildInstitutionCitation(
  row: InstitutionCitationRow,
  source: EntityCitationSource,
  revision: EntityRevisionRelease,
  resolvedAt: string = nowIso(),
): InstitutionCitation {
  return {
    schemaVersion: STABLE_ENTITY_CITATION_SCHEMA_VERSION,
    entityType: "institution",
    id: row.id,
    label: `${row.jurisdictionName} — ${row.name}`,
    citationUrl: buildCitationUrl("institution", row.id),
    readerUrl: absoluteUrl(
      `/country/${encodeURIComponent(row.jurisdictionSlug)}/civica-data`,
    ),
    source,
    jurisdictionSlug: row.jurisdictionSlug,
    jurisdictionName: row.jurisdictionName,
    bodyType: row.bodyType,
    revision,
    resolvedAt,
  };
}

export async function resolveInstitutionCitation(
  id: string,
): Promise<InstitutionCitation | null> {
  const rows = await db
    .select({
      id: governmentBodies.id,
      jurisdictionSlug: jurisdictions.slug,
      jurisdictionName: jurisdictions.name,
      name: governmentBodies.name,
      bodyType: governmentBodies.bodyType,
      ipuParlineId: governmentBodies.ipuParlineId,
      wikidataQid: governmentBodies.wikidataQid,
    })
    .from(governmentBodies)
    .innerJoin(
      jurisdictions,
      eq(governmentBodies.jurisdictionId, jurisdictions.id),
    )
    .where(eq(governmentBodies.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const [source, revision] = await Promise.all([
    fetchSourceCitation(deriveHeuristicSourceId(row)),
    fetchRevisionRelease("government_bodies", id),
  ]);
  return buildInstitutionCitation(row, source, revision);
}
