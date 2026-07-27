/**
 * ATL-019 — small DB-read helpers shared by every entity resolver. Every
 * function here issues SELECT-only queries against the app's lazy
 * `@/lib/db` client (read-only in effect; there is no write path in this
 * module).
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { researchEvidenceHistory, sources } from "@/lib/db/schema";
import {
  deriveRevisionRelease,
  UNKNOWN_SOURCE,
  type EntityCitationSource,
  type EntityRevisionRelease,
} from "@/lib/citations/stable-identity";

export function nowIso(): string {
  return new Date().toISOString();
}

export function toIsoOrNull(
  value: Date | string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Resolve a `sources.id` to the citation's source/license leg. `null` input
 *  (source not asserted / not applicable) returns the explicit unknown
 *  shape rather than throwing. */
export async function fetchSourceCitation(
  sourceId: string | null,
): Promise<EntityCitationSource> {
  if (!sourceId) return UNKNOWN_SOURCE;
  const rows = await db
    .select({
      id: sources.id,
      name: sources.name,
      license: sources.license,
      baseUrl: sources.baseUrl,
    })
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);
  const row = rows[0];
  if (!row) return { ...UNKNOWN_SOURCE, sourceId };
  return {
    sourceId: row.id,
    sourceName: row.name,
    licenseId: row.license,
    sourceUrl: row.baseUrl ?? null,
  };
}

/** DAT-016 — the append-only `research_evidence_history` revision leg for
 *  institution/office/person/election citations (AGENTS.md "Research
 *  evidence retention"; `src/lib/research/evidence-retention.ts`). */
export async function fetchRevisionRelease(
  entityTable: string,
  entityId: string,
): Promise<EntityRevisionRelease> {
  const rows = await db
    .select({
      recordedAt: researchEvidenceHistory.recordedAt,
      reason: researchEvidenceHistory.reason,
    })
    .from(researchEvidenceHistory)
    .where(
      and(
        eq(researchEvidenceHistory.entityTable, entityTable),
        eq(researchEvidenceHistory.entityId, entityId),
      ),
    )
    .orderBy(desc(researchEvidenceHistory.recordedAt));
  return deriveRevisionRelease(
    rows.map((row) => ({ recordedAt: row.recordedAt, reason: row.reason })),
  );
}
