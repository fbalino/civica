/**
 * ATL-019 — `election` entity citation resolver.
 *
 * Backing table: `elections`. The stable id is `elections.id` (UUID
 * primary key) — never `election_name`, which can be edited for clarity
 * without the election ceasing to be the same citable event.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { elections, jurisdictions } from "@/lib/db/schema";
import {
  STABLE_ENTITY_CITATION_SCHEMA_VERSION,
  buildCitationUrl,
  deriveHeuristicSourceId,
  type ElectionCitation,
  type EntityCitationSource,
  type EntityRevisionRelease,
} from "@/lib/citations/stable-identity";
import { fetchRevisionRelease, fetchSourceCitation, nowIso } from "./shared";

export interface ElectionCitationRow {
  id: string;
  jurisdictionSlug: string;
  jurisdictionName: string;
  electionName: string | null;
  electionType: string | null;
  electionDate: string | null;
  wikidataQid: string | null;
}

/** Pure — no DB access. */
export function buildElectionCitation(
  row: ElectionCitationRow,
  source: EntityCitationSource,
  revision: EntityRevisionRelease,
  resolvedAt: string = nowIso(),
): ElectionCitation {
  const eventLabel = row.electionName ?? row.electionType ?? "Election";
  return {
    schemaVersion: STABLE_ENTITY_CITATION_SCHEMA_VERSION,
    entityType: "election",
    id: row.id,
    label: row.electionDate
      ? `${row.jurisdictionName} — ${eventLabel} (${row.electionDate})`
      : `${row.jurisdictionName} — ${eventLabel}`,
    citationUrl: buildCitationUrl("election", row.id),
    // No precise per-election reader deep link exists in the current IA
    // (`/elections` is a global calendar with no per-row anchor) — leaving
    // this `null` is more honest than pointing at an imprecise page.
    readerUrl: null,
    source,
    jurisdictionSlug: row.jurisdictionSlug,
    jurisdictionName: row.jurisdictionName,
    electionDate: row.electionDate ?? null,
    revision,
    resolvedAt,
  };
}

export async function resolveElectionCitation(
  id: string,
): Promise<ElectionCitation | null> {
  const rows = await db
    .select({
      id: elections.id,
      jurisdictionSlug: jurisdictions.slug,
      jurisdictionName: jurisdictions.name,
      electionName: elections.electionName,
      electionType: elections.electionType,
      electionDate: elections.electionDate,
      wikidataQid: elections.wikidataQid,
    })
    .from(elections)
    .innerJoin(jurisdictions, eq(elections.jurisdictionId, jurisdictions.id))
    .where(eq(elections.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const [source, revision] = await Promise.all([
    fetchSourceCitation(deriveHeuristicSourceId(row)),
    fetchRevisionRelease("elections", id),
  ]);
  return buildElectionCitation(row, source, revision);
}
