/**
 * ATL-019 — `office` entity citation resolver.
 *
 * Backing table: `offices`. The stable id is `offices.id` (UUID primary
 * key) — never `name` (e.g. "Minister of Finance" can be relabeled without
 * the office ceasing to be the same citable entity).
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { governmentBodies, jurisdictions, offices } from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/site";
import {
  STABLE_ENTITY_CITATION_SCHEMA_VERSION,
  buildCitationUrl,
  deriveHeuristicSourceId,
  type EntityCitationSource,
  type EntityRevisionRelease,
  type OfficeCitation,
} from "@/lib/citations/stable-identity";
import { fetchRevisionRelease, fetchSourceCitation, nowIso } from "./shared";

export interface OfficeCitationRow {
  id: string;
  jurisdictionSlug: string;
  jurisdictionName: string;
  name: string;
  officeType: string;
  wikidataQid: string | null;
}

/** Pure — no DB access. */
export function buildOfficeCitation(
  row: OfficeCitationRow,
  source: EntityCitationSource,
  revision: EntityRevisionRelease,
  resolvedAt: string = nowIso(),
): OfficeCitation {
  return {
    schemaVersion: STABLE_ENTITY_CITATION_SCHEMA_VERSION,
    entityType: "office",
    id: row.id,
    label: `${row.jurisdictionName} — ${row.name}`,
    citationUrl: buildCitationUrl("office", row.id),
    readerUrl: absoluteUrl(
      `/country/${encodeURIComponent(row.jurisdictionSlug)}/civica-data`,
    ),
    source,
    jurisdictionSlug: row.jurisdictionSlug,
    jurisdictionName: row.jurisdictionName,
    officeType: row.officeType,
    revision,
    resolvedAt,
  };
}

export async function resolveOfficeCitation(
  id: string,
): Promise<OfficeCitation | null> {
  const rows = await db
    .select({
      id: offices.id,
      jurisdictionSlug: jurisdictions.slug,
      jurisdictionName: jurisdictions.name,
      name: offices.name,
      officeType: offices.officeType,
      wikidataQid: offices.wikidataQid,
    })
    .from(offices)
    .innerJoin(governmentBodies, eq(offices.bodyId, governmentBodies.id))
    .innerJoin(
      jurisdictions,
      eq(governmentBodies.jurisdictionId, jurisdictions.id),
    )
    .where(eq(offices.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const [source, revision] = await Promise.all([
    fetchSourceCitation(deriveHeuristicSourceId(row)),
    fetchRevisionRelease("offices", id),
  ]);
  return buildOfficeCitation(row, source, revision);
}
