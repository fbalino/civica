/**
 * ATL-019 — `constitution-passage` entity citation resolver.
 *
 * This kind is ALREADY SHIPPED: `constitution_passages.passage_id`
 * (`constitution-passage/sha256:<hex>`, produced by
 * `constitutionPassageId()` in `src/lib/constitution/passage-index.ts`) is a
 * content-and-source-version-bound digest, and
 * `/api/constitution/passages/[digest]` already resolves it to a citation
 * shape (source, rights, reader URL, current/superseded state). This
 * resolver does NOT re-derive that identity scheme or re-implement its
 * rights gate — it adapts the SAME persisted `passage_id` primary key into
 * the generic `EntityCitation` contract so `constitution-passage` sits in
 * the same closed `entityType` enum as the other seven kinds.
 *
 * Per the shipped route's convention, the citation `id` is the bare
 * `sha256:<hex>` digest (the route's `[digest]` segment), NOT the full
 * `constitution-passage/sha256:<hex>` primary key — that keeps the id a
 * single URL-safe path segment.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { constitutionPassages, jurisdictions } from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/site";
import {
  STABLE_ENTITY_CITATION_SCHEMA_VERSION,
  buildCitationUrl,
  type ConstitutionPassageCitation,
  type EntityCitationSource,
} from "@/lib/citations/stable-identity";
import { fetchSourceCitation, nowIso, toIsoOrNull } from "./shared";

export interface ConstitutionPassageCitationRow {
  /** Bare `sha256:<hex>` digest — see module doc. */
  digestId: string;
  jurisdictionSlug: string;
  jurisdictionName: string;
  headingLabel: string | null;
  sourceSectionId: string;
  anchorId: string;
  isCurrent: boolean;
  supersededAt: Date | string | null;
}

/** Pure — no DB access. */
export function buildConstitutionPassageCitation(
  row: ConstitutionPassageCitationRow,
  source: EntityCitationSource,
  resolvedAt: string = nowIso(),
): ConstitutionPassageCitation {
  return {
    schemaVersion: STABLE_ENTITY_CITATION_SCHEMA_VERSION,
    entityType: "constitution-passage",
    id: row.digestId,
    label: `${row.jurisdictionName} constitution — ${row.headingLabel ?? row.sourceSectionId}`,
    citationUrl: buildCitationUrl("constitution-passage", row.digestId),
    readerUrl: row.isCurrent
      ? absoluteUrl(
          `/constitution?c=${encodeURIComponent(row.jurisdictionSlug)}#${encodeURIComponent(row.anchorId)}`,
        )
      : null,
    source,
    jurisdictionSlug: row.jurisdictionSlug,
    jurisdictionName: row.jurisdictionName,
    anchorId: row.anchorId,
    current: row.isCurrent,
    supersededAt: toIsoOrNull(row.supersededAt),
    resolvedAt,
  };
}

export async function resolveConstitutionPassageCitation(
  digestId: string,
): Promise<ConstitutionPassageCitation | null> {
  const passageId = `constitution-passage/${digestId}`;
  const rows = await db
    .select({
      jurisdictionSlug: jurisdictions.slug,
      jurisdictionName: jurisdictions.name,
      headingLabel: constitutionPassages.headingLabel,
      sourceSectionId: constitutionPassages.sourceSectionId,
      anchorId: constitutionPassages.anchorId,
      sourceId: constitutionPassages.sourceId,
      isCurrent: constitutionPassages.isCurrent,
      supersededAt: constitutionPassages.supersededAt,
    })
    .from(constitutionPassages)
    .innerJoin(
      jurisdictions,
      eq(constitutionPassages.jurisdictionId, jurisdictions.id),
    )
    .where(eq(constitutionPassages.passageId, passageId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const source = await fetchSourceCitation(row.sourceId);
  return buildConstitutionPassageCitation({ ...row, digestId }, source);
}
