/**
 * DAT-037 reader provenance for a country's CIA World Leaders cabinet roster:
 * whether any cabinet row in this country is sourced to the roster, and the
 * page's "Last Updated" date recorded as the body-level roster statement.
 */
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  CABINET_MEMBER_PREDICATE,
  CABINET_ROSTER_PREDICATE,
  CIA_ROSTER_SOURCE_ID,
  timestampEpoch,
} from "@/lib/factbook/cabinet-roster";
import { rethrowDatabaseFailure } from "@/lib/platform/cached-render";

export interface CabinetRosterProvenance {
  /** True when at least one executive term cites the CIA roster. */
  hasRosterRows: boolean;
  /** The roster page's "Last Updated" date (ISO), when recorded. */
  rosterUpdated: string | null;
  /** First retrieval that observed this roster content. */
  retrievedAt: string | null;
  sourceUrl: string | null;
}

function rows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return ((result as { rows?: Record<string, unknown>[] } | null)?.rows ?? []);
}

/**
 * One read. Soft-fails to `null` so a database hiccup drops the credit line,
 * never the section.
 */
export async function getCabinetRosterProvenance(
  scope: { jurisdictionId: string } | { executiveBodyId: string },
): Promise<CabinetRosterProvenance | null> {
  const bodyFilter =
    "executiveBodyId" in scope
      ? sql`b.id = ${scope.executiveBodyId}::uuid`
      : sql`b.jurisdiction_id = ${scope.jurisdictionId}::uuid`;
  try {
    const [row] = rows(
      await db.execute(sql`
        SELECT roster.object_value AS roster_updated,
               roster.retrieved_at::text AS retrieved_at,
               roster.source_url AS source_url,
               EXISTS (
                 SELECT 1
                 FROM statements s
                 JOIN terms t ON s.subject_table = 'terms' AND s.subject_id = t.id
                 JOIN offices o ON o.id = t.office_id
                 JOIN government_bodies b ON b.id = o.body_id
                 WHERE ${bodyFilter}
                   AND b.branch = 'executive'
                   AND s.source_id = ${CIA_ROSTER_SOURCE_ID}
                   AND s.predicate = ${CABINET_MEMBER_PREDICATE}
               ) AS has_roster_rows
        FROM (SELECT 1) anchor
        LEFT JOIN LATERAL (
          SELECT s.object_value, s.retrieved_at, s.source_url
          FROM statements s
          JOIN government_bodies b
            ON s.subject_table = 'government_bodies' AND s.subject_id = b.id
          WHERE ${bodyFilter}
            AND b.branch = 'executive'
            AND s.predicate = ${CABINET_ROSTER_PREDICATE}
            AND s.source_id = ${CIA_ROSTER_SOURCE_ID}
          ORDER BY s.id
          LIMIT 1
        ) roster ON true`),
    );
    if (!row) return null;
    const isoDate =
      typeof row.roster_updated === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.roster_updated)
        ? row.roster_updated
        : null;
    const retrievedEpoch =
      typeof row.retrieved_at === "string" ? timestampEpoch(row.retrieved_at) : null;
    return {
      hasRosterRows: row.has_roster_rows === true || row.has_roster_rows === "t",
      rosterUpdated: isoDate,
      retrievedAt:
        retrievedEpoch === null ? null : new Date(retrievedEpoch).toISOString(),
      sourceUrl: typeof row.source_url === "string" ? row.source_url : null,
    };
  } catch (error) {
    // Its only readers are cached country pages: a failed read aborts the
    // render rather than caching a roster without provenance (PLT-033).
    rethrowDatabaseFailure(error);
    return null;
  }
}

/** "27 Aug 2026" for an ISO date, in UTC. */
export function formatRosterDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
