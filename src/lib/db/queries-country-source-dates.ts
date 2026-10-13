import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

/**
 * APR-D179 — the date a country page shows beside each source.
 *
 * Country pages show, per source, the latest time Civica recorded THIS
 * country's rows from that source (for example, the latest `retrieved_at` of
 * the country's facts from World Bank), not the source-wide
 * `sources.last_sync_at`. A source-wide sync time changes every night for
 * every country whenever any country's import runs, which would force every
 * cached country page to be rebuilt; this date changes only when the
 * country's own rows do. It is a Civica retrieval clock, never a publisher
 * vintage (APR-D058).
 *
 * Inputs, all scoped to the one jurisdiction:
 * - active `country_facts` rows (`retrieved_at`);
 * - `statements` about the jurisdiction, its government bodies, its terms of
 *   office, its elections, and its constitution (`retrieved_at`);
 * - `bills` (`updated_at`, which changes only when a bill's content does);
 * - `indicator_history` (`updated_at`);
 * - `organization_memberships` (`source_retrieved_at`);
 * - `party_composition_runs` for its bodies (`source_retrieved_at`);
 * - its `constitutions` row (`last_fetched`, as `constitute_project`).
 */
export async function getCountrySourceDates(
  jurisdictionId: string,
): Promise<Map<string, Date>> {
  const result = await db.execute(sql`
    WITH bodies AS (
      SELECT id FROM government_bodies WHERE jurisdiction_id = ${jurisdictionId}
    ),
    subjects AS (
      SELECT ${jurisdictionId}::uuid AS id
      UNION ALL SELECT id FROM bodies
      UNION ALL SELECT t.id FROM terms t JOIN offices o ON o.id = t.office_id
        WHERE o.body_id IN (SELECT id FROM bodies)
      UNION ALL SELECT id FROM elections WHERE jurisdiction_id = ${jurisdictionId}
      UNION ALL SELECT id FROM constitutions WHERE jurisdiction_id = ${jurisdictionId}
    ),
    dated AS (
      SELECT source_id, retrieved_at AS at FROM country_facts
        WHERE jurisdiction_id = ${jurisdictionId} AND status = 'active'
      UNION ALL SELECT source_id, retrieved_at FROM statements
        WHERE subject_id IN (SELECT id FROM subjects)
      UNION ALL SELECT source_id, updated_at FROM bills
        WHERE jurisdiction_id = ${jurisdictionId}
      UNION ALL SELECT source_id, updated_at FROM indicator_history
        WHERE jurisdiction_id = ${jurisdictionId}
      UNION ALL SELECT source_id, source_retrieved_at FROM organization_memberships
        WHERE jurisdiction_id = ${jurisdictionId}
      UNION ALL SELECT source_id, source_retrieved_at FROM party_composition_runs
        WHERE body_id IN (SELECT id FROM bodies)
      UNION ALL SELECT 'constitute_project', last_fetched FROM constitutions
        WHERE jurisdiction_id = ${jurisdictionId}
    )
    SELECT source_id, (extract(epoch FROM max(at)) * 1000)::float8 AS at_ms
    FROM dated
    WHERE source_id IS NOT NULL AND at IS NOT NULL
    GROUP BY source_id
  `);
  const rows = (
    Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
  ) as Array<{ source_id: string; at_ms: number | string }>;
  const dates = new Map<string, Date>();
  for (const row of rows) {
    const ms = Number(row.at_ms);
    if (Number.isFinite(ms)) dates.set(row.source_id, new Date(ms));
  }
  return dates;
}

/**
 * Replace each source's `lastSyncAt` with this country's own date for it, so
 * existing source-strip code shows the country date. A source with no row
 * for this country has no date.
 */
export function withCountrySourceDates<T extends { id: string; lastSyncAt: Date | null }>(
  sources: readonly T[],
  dates: ReadonlyMap<string, Date>,
): T[] {
  return sources.map((source) => ({
    ...source,
    lastSyncAt: dates.get(source.id) ?? null,
  }));
}
