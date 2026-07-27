/**
 * ATL-019 — `organization` entity citation resolver.
 *
 * Backing table: `organizations`. The stable id is `organizations.id`
 * (UUID primary key) — never `name`/`full_name`/`slug`, all of which are
 * display text that can be corrected (e.g. an abbreviation expansion fix)
 * without the organization ceasing to be the same citable entity.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/site";
import {
  STABLE_ENTITY_CITATION_SCHEMA_VERSION,
  buildCitationUrl,
  deriveHeuristicSourceId,
  type EntityCitationSource,
  type OrganizationCitation,
} from "@/lib/citations/stable-identity";
import { fetchSourceCitation, nowIso } from "./shared";

export interface OrganizationCitationRow {
  id: string;
  slug: string;
  name: string;
  fullName: string;
  wikidataQid: string | null;
}

/** Pure — no DB access. */
export function buildOrganizationCitation(
  row: OrganizationCitationRow,
  source: EntityCitationSource,
  resolvedAt: string = nowIso(),
): OrganizationCitation {
  return {
    schemaVersion: STABLE_ENTITY_CITATION_SCHEMA_VERSION,
    entityType: "organization",
    id: row.id,
    label: row.fullName || row.name,
    citationUrl: buildCitationUrl("organization", row.id),
    readerUrl: absoluteUrl(`/organizations/${encodeURIComponent(row.slug)}`),
    source,
    slug: row.slug,
    resolvedAt,
  };
}

export async function resolveOrganizationCitation(
  id: string,
): Promise<OrganizationCitation | null> {
  const rows = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      fullName: organizations.fullName,
      wikidataQid: organizations.wikidataQid,
    })
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const source = await fetchSourceCitation(deriveHeuristicSourceId(row));
  return buildOrganizationCitation(row, source);
}
