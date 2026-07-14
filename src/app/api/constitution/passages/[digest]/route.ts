import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { evaluateInteractiveDisplay } from "@/lib/rights/manifest";

const DIGEST = /^sha256:([a-f0-9]{64})$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ digest: string }> },
) {
  const limited = await enforceRequestRateLimit(
    request,
    getRequestRateLimitPolicy("public-dynamic-read"),
  );
  if (limited) return limited;
  const { digest } = await params;
  const match = DIGEST.exec(digest);
  if (!match)
    return Response.json({ error: "Invalid passage id" }, { status: 400 });

  const rights = evaluateInteractiveDisplay(
    "constitution-search-display-v1",
    "constitute_project",
    {
      commercial: process.env.CIVICA_COMMERCIAL_DEPLOYMENT === "true",
      feeBearing: process.env.CIVICA_FEE_BEARING_ACCESS === "true",
    },
  );
  if (!rights.allowed) {
    return Response.json(
      { error: "rights_not_ready", message: rights.reason },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const passageId = `constitution-passage/sha256:${match[1]}`;
  try {
    const result = await db.execute(sql`
      SELECT
        p.passage_id, p.source_document_id, p.source_section_id, p.anchor_id,
        p.heading_label, p.topic_keys, p.content_sha256, p.language_code,
        p.language_basis, p.translation_status, p.original_language_code,
        p.translator, p.source_url, p.retrieval_url, p.retrieved_at,
        p.is_current, p.superseded_at,
        left(p.plain_text, 1000) AS bounded_excerpt,
        c.year, c.year_updated,
        j.slug, j.name
      FROM constitution_passages p
      JOIN constitutions c ON c.id = p.constitution_id
      JOIN jurisdictions j ON j.id = p.jurisdiction_id
      WHERE p.passage_id = ${passageId}
      LIMIT 1
    `);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row)
      return Response.json({ error: "Passage not found" }, { status: 404 });
    const current = Boolean(row.is_current);
    return Response.json(
      {
        schemaVersion: "constitution-passage-citation/v1",
        passageId,
        current,
        readerUrl: current
          ? `/constitution?c=${encodeURIComponent(String(row.slug))}#${encodeURIComponent(String(row.anchor_id))}`
          : null,
        jurisdiction: { slug: row.slug, name: row.name },
        constitution: {
          sourceDocumentId: row.source_document_id,
          year: row.year,
          yearUpdated: row.year_updated,
        },
        passage: {
          sourceSectionId: row.source_section_id,
          anchorId: row.anchor_id,
          headingLabel: row.heading_label,
          topicKeys: row.topic_keys,
          boundedExcerpt: row.bounded_excerpt,
          excerptTruncated: String(row.bounded_excerpt).length >= 1000,
          language: {
            code: row.language_code,
            basis: row.language_basis,
            translationStatus: row.translation_status,
            originalLanguageCode: row.original_language_code,
            translator: row.translator,
          },
        },
        provenance: {
          sourceId: "constitute_project",
          sourceUrl: row.source_url,
          retrievalUrl: row.retrieval_url,
          retrievedAt: row.retrieved_at,
          contentSha256: row.content_sha256,
          licenseId: "CC-BY-NC-3.0",
          termsUrl: "https://www.constituteproject.org/content/terms",
        },
        supersededAt: row.superseded_at,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  } catch (error) {
    console.error("[/api/constitution/passages]", error);
    return Response.json(
      {
        error: "data_unavailable",
        message: "Passage citation is unavailable.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
