/**
 * ATL-019 — `person` entity citation resolver.
 *
 * Backing table: `persons`. The stable id is `persons.id` (UUID primary
 * key) — never `name` (transliteration/spelling corrections must not
 * change identity).
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  governmentBodies,
  jurisdictions,
  offices,
  persons,
  terms,
} from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/site";
import {
  STABLE_ENTITY_CITATION_SCHEMA_VERSION,
  buildCitationUrl,
  deriveHeuristicSourceId,
  type EntityCitationSource,
  type EntityRevisionRelease,
  type PersonCitation,
} from "@/lib/citations/stable-identity";
import { fetchRevisionRelease, fetchSourceCitation, nowIso } from "./shared";

export interface PersonCitationRow {
  id: string;
  name: string;
  wikidataQid: string | null;
}

/** Pure — no DB access. `currentJurisdictionSlug` is a best-effort deep
 *  link derived from the person's CURRENT term, if any; `null` when the
 *  person holds no current office (still a perfectly valid citable person). */
export function buildPersonCitation(
  row: PersonCitationRow,
  currentJurisdictionSlug: string | null,
  source: EntityCitationSource,
  revision: EntityRevisionRelease,
  resolvedAt: string = nowIso(),
): PersonCitation {
  return {
    schemaVersion: STABLE_ENTITY_CITATION_SCHEMA_VERSION,
    entityType: "person",
    id: row.id,
    label: row.name,
    citationUrl: buildCitationUrl("person", row.id),
    readerUrl: currentJurisdictionSlug
      ? absoluteUrl(
          `/country/${encodeURIComponent(currentJurisdictionSlug)}/civica-data`,
        )
      : null,
    source,
    revision,
    resolvedAt,
  };
}

export async function resolvePersonCitation(
  id: string,
): Promise<PersonCitation | null> {
  const rows = await db
    .select({ id: persons.id, name: persons.name, wikidataQid: persons.wikidataQid })
    .from(persons)
    .where(eq(persons.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [currentTermRows, source, revision] = await Promise.all([
    db
      .select({ jurisdictionSlug: jurisdictions.slug })
      .from(terms)
      .innerJoin(offices, eq(terms.officeId, offices.id))
      .innerJoin(governmentBodies, eq(offices.bodyId, governmentBodies.id))
      .innerJoin(
        jurisdictions,
        eq(governmentBodies.jurisdictionId, jurisdictions.id),
      )
      .where(and(eq(terms.personId, id), eq(terms.isCurrent, true)))
      .limit(1),
    fetchSourceCitation(deriveHeuristicSourceId(row)),
    fetchRevisionRelease("persons", id),
  ]);

  return buildPersonCitation(
    row,
    currentTermRows[0]?.jurisdictionSlug ?? null,
    source,
    revision,
  );
}
