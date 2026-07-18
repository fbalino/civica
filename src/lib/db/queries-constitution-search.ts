import { createServerlessSql } from "@/lib/db";
import { isKnownConstitutionTopic } from "@/lib/constitute/topic-keys";
import { buildJurisdictionStatusPresentation } from "@/lib/jurisdictions/status-presentation";
import {
  CONSTITUTION_SEARCH_INDEX_VERSION,
  CONSTITUTION_PASSAGE_LANGUAGE_BASIS,
  CONSTITUTION_PASSAGE_TRANSLATION_STATUS,
} from "@/lib/constitution/passage-contract";
import {
  CONSTITUTION_SEARCH_RANKING_METHOD,
  CONSTITUTION_SEARCH_SCHEMA_VERSION,
  constitutionDocumentContext,
  constitutionSearchInputSchema,
  normalizeConstitutionSearchQuery,
  type ConstitutionSearchErrorCode,
  type ConstitutionSearchHighlightSegment,
  type ConstitutionSearchInput,
  type ConstitutionSearchResponse,
  type ConstitutionSearchResult,
} from "@/lib/constitution/search-contract";
import {
  CONSTITUTION_DISPLAY_RIGHTS,
  evaluateConstitutionInteractiveDisplay,
} from "@/lib/rights/constitution-display";

const PRODUCT_ID = CONSTITUTION_DISPLAY_RIGHTS.productId;
const SOURCE_ID = CONSTITUTION_DISPLAY_RIGHTS.sourceId;
const TERMS_URL = CONSTITUTION_DISPLAY_RIGHTS.termsUrl;
const HIGHLIGHT_START = "__CIVICA_HIGHLIGHT_START__";
const HIGHLIGHT_STOP = "__CIVICA_HIGHLIGHT_STOP__";
const HEADLINE_OPTIONS = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_STOP}, MaxFragments=1, MinWords=12, MaxWords=32, FragmentDelimiter=" … "`;

export class ConstitutionSearchQueryError extends Error {
  constructor(
    public readonly code: ConstitutionSearchErrorCode,
    message: string,
    public readonly status: 400 | 409 | 422 | 429 | 503 | 504,
    public readonly details?: { uncoveredJurisdictions: string[] },
  ) {
    super(message);
    this.name = "ConstitutionSearchQueryError";
  }
}

type SearchCursor = {
  version: 1;
  fingerprint: string;
  rank: number;
  passageId: string;
};

let searchSql: ReturnType<typeof createServerlessSql> | null = null;

function getSearchSql(): ReturnType<typeof createServerlessSql> {
  if (!searchSql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    searchSql = createServerlessSql(process.env.DATABASE_URL);
  }
  return searchSql;
}

async function fingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

function encodeCursor(cursor: SearchCursor): string {
  return toBase64Url(JSON.stringify(cursor));
}

function decodeCursor(raw: string | null): SearchCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Partial<SearchCursor>;
    if (
      parsed.version !== 1 ||
      typeof parsed.fingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(parsed.fingerprint) ||
      typeof parsed.rank !== "number" ||
      !Number.isFinite(parsed.rank) ||
      typeof parsed.passageId !== "string" ||
      !/^constitution-passage\/sha256:[a-f0-9]{64}$/.test(parsed.passageId)
    ) {
      throw new Error("invalid cursor");
    }
    return parsed as SearchCursor;
  } catch {
    throw new ConstitutionSearchQueryError(
      "cursor_stale",
      "The search cursor is invalid or belongs to a different query or corpus version.",
      409,
    );
  }
}

export function parseConstitutionSearchHighlight(
  headline: string,
): ConstitutionSearchHighlightSegment[] {
  const parts = headline.split(
    new RegExp(`(${HIGHLIGHT_START}|${HIGHLIGHT_STOP})`, "g"),
  );
  let highlighted = false;
  const segments: ConstitutionSearchHighlightSegment[] = [];
  for (const part of parts) {
    if (part === HIGHLIGHT_START) {
      highlighted = true;
      continue;
    }
    if (part === HIGHLIGHT_STOP) {
      highlighted = false;
      continue;
    }
    if (!part) continue;
    const previous = segments.at(-1);
    if (previous?.highlighted === highlighted) previous.text += part;
    else segments.push({ text: part, highlighted });
  }
  return segments;
}

function rows(result: unknown): Record<string, unknown>[] {
  return (
    Array.isArray(result)
      ? result
      : ((result as { rows?: Record<string, unknown>[] }).rows ?? [])
  ) as Record<string, unknown>[];
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}

function deploymentRights() {
  return evaluateConstitutionInteractiveDisplay(PRODUCT_ID, SOURCE_ID, {
    commercial: process.env.CIVICA_COMMERCIAL_DEPLOYMENT === "true",
    feeBearing: process.env.CIVICA_FEE_BEARING_ACCESS === "true",
  });
}

async function withSearchTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ConstitutionSearchQueryError(
                "query_timeout",
                "The constitution search exceeded its one-second database limit.",
                504,
              ),
            ),
          2_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Indexed, passage-grain lexical search. Expected failures remain typed and
 * are never converted to an empty result set.
 */
export async function searchConstitutionPassages(
  rawInput: ConstitutionSearchInput,
): Promise<ConstitutionSearchResponse> {
  const parsed = constitutionSearchInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ConstitutionSearchQueryError(
      "invalid_request",
      parsed.error.issues[0]?.message ?? "Invalid constitution search request.",
      400,
    );
  }
  const input = parsed.data;
  const normalized = normalizeConstitutionSearchQuery(input.query);
  const invalidTopic = input.topics.find(
    (topic) => !isKnownConstitutionTopic(topic),
  );
  if (invalidTopic) {
    throw new ConstitutionSearchQueryError(
      "invalid_request",
      `Unknown constitutional topic: ${invalidTopic}`,
      400,
    );
  }
  const rightsDecision = deploymentRights();
  if (!rightsDecision.allowed) {
    throw new ConstitutionSearchQueryError(
      "rights_not_ready",
      rightsDecision.reason,
      503,
    );
  }

  try {
    const cursor = decodeCursor(input.cursor);
    const query = getSearchSql();

    const [, metadataResult, result] = await withSearchTimeout(
      query.transaction((txn) => {
        const jurisdictionCondition =
          input.jurisdictions.length === 0
            ? txn`TRUE`
            : txn`j.slug = ANY(${input.jurisdictions}::text[])`;
        const topicCondition =
          input.topics.length === 0
            ? txn`TRUE`
            : txn`p.topic_keys ?| ${input.topics}::text[]`;
        const cursorCondition = cursor
          ? txn`(rank < ${cursor.rank} OR (rank = ${cursor.rank} AND passage_id > ${cursor.passageId}))`
          : txn`TRUE`;

        return [
          txn`SET LOCAL statement_timeout = '1000ms'`,
          txn`
          SELECT
            (SELECT last_sync_at FROM sources WHERE id = ${SOURCE_ID}) AS last_sync_at,
            numnode(websearch_to_tsquery('english'::regconfig, ${normalized})) AS nodes,
            querytree(websearch_to_tsquery('english'::regconfig, ${normalized})) AS tree,
            COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'slug', requested.slug,
                    'exists', j.id IS NOT NULL,
                    'covered', CASE WHEN j.id IS NULL THEN false ELSE EXISTS (
                      SELECT 1 FROM constitution_passages coverage
                      WHERE coverage.jurisdiction_id = j.id
                        AND coverage.is_current = true
                    ) END
                  )
                  ORDER BY requested.slug
                )
                FROM unnest(${input.jurisdictions}::text[]) requested(slug)
                LEFT JOIN jurisdictions j ON j.slug = requested.slug
              ),
              '[]'::jsonb
            ) AS jurisdiction_checks
          `,
          txn`
        WITH q AS (
          SELECT websearch_to_tsquery('english'::regconfig, ${normalized}) AS query
        ), ranked AS (
          SELECT
            p.passage_id,
            p.constitution_id,
            p.source_document_id,
            p.source_section_id,
            p.anchor_id,
            p.heading_label,
            p.topic_keys,
            p.content_sha256,
            p.source_url,
            p.retrieval_url,
            p.retrieved_at,
            c.year,
            c.year_updated,
            j.id AS jurisdiction_id,
            j.slug,
            j.name,
            j.iso2,
            j.iso3,
            j.type AS jurisdiction_status,
            j.status_source_ids,
            j.status_reviewed_at::text,
            j.status_note,
            j.administering_jurisdiction_iso3,
            j.status_disputed,
            ts_rank_cd(p.search_vector, q.query)::real AS rank,
            q.query
          FROM constitution_passages p
          JOIN constitutions c ON c.id = p.constitution_id
          JOIN jurisdictions j ON j.id = p.jurisdiction_id
          CROSS JOIN q
          WHERE p.is_current = true
            AND p.search_vector @@ q.query
            AND ${jurisdictionCondition}
            AND ${topicCondition}
        ), page AS (
          SELECT * FROM ranked WHERE ${cursorCondition}
          ORDER BY rank DESC, passage_id ASC
          LIMIT ${input.limit + 1}
        )
        SELECT page.*,
          ts_headline(
            'english'::regconfig,
            passage_text.plain_text,
            page.query,
            ${HEADLINE_OPTIONS}
          ) AS headline
        FROM page
        JOIN constitution_passages passage_text
          ON passage_text.passage_id = page.passage_id
        ORDER BY page.rank DESC, page.passage_id ASC
          `,
        ];
      }),
    );

    const metadata = rows(metadataResult)[0];
    const sourceLastSyncedAt = iso(metadata?.last_sync_at);
    if (!sourceLastSyncedAt) {
      throw new ConstitutionSearchQueryError(
        "data_unavailable",
        "The constitution corpus has no successful source synchronization timestamp.",
        503,
      );
    }

    const jurisdictionChecks = (metadata?.jurisdiction_checks ?? []) as Array<{
      slug: string;
      exists: boolean;
      covered: boolean;
    }>;
    const unknown = jurisdictionChecks.find((check) => !check.exists)?.slug;
    if (unknown) {
      throw new ConstitutionSearchQueryError(
        "invalid_request",
        `Unknown jurisdiction: ${unknown}`,
        400,
      );
    }
    const uncovered = jurisdictionChecks
      .filter((check) => !check.covered)
      .map((check) => check.slug)
      .sort();
    if (uncovered.length > 0) {
      throw new ConstitutionSearchQueryError(
        "jurisdiction_not_covered",
        `No indexed constitution is available for: ${uncovered.join(", ")}.`,
        422,
        { uncoveredJurisdictions: uncovered },
      );
    }

    const nodes = Number(metadata?.nodes ?? 0);
    const tree = String(metadata?.tree ?? "");
    if (nodes === 0 || !tree || tree === "T") {
      throw new ConstitutionSearchQueryError(
        "query_not_searchable",
        "The query contains no searchable English terms.",
        400,
      );
    }
    if (nodes > 24) {
      throw new ConstitutionSearchQueryError(
        "invalid_request",
        "The query contains too many search terms or operators.",
        400,
      );
    }

    const cursorFingerprint = await fingerprint({
      normalized,
      jurisdictions: input.jurisdictions,
      topics: input.topics,
      language: input.language,
      indexVersion: CONSTITUTION_SEARCH_INDEX_VERSION,
      sourceLastSyncedAt,
    });
    if (cursor && cursor.fingerprint !== cursorFingerprint) {
      throw new ConstitutionSearchQueryError(
        "cursor_stale",
        "The search cursor is invalid or belongs to a different query or corpus version.",
        409,
      );
    }

    const allRows = rows(result);
    const hasMore = allRows.length > input.limit;
    const pageRows = allRows.slice(0, input.limit);
    const data: ConstitutionSearchResult[] = pageRows.map((row) => {
      const status = buildJurisdictionStatusPresentation({
        slug: String(row.slug),
        iso3: row.iso3 == null ? null : String(row.iso3),
        type: String(row.jurisdiction_status),
        statusSourceIds: row.status_source_ids as string[],
        statusReviewedAt: String(row.status_reviewed_at),
        statusNote: String(row.status_note),
        administeringJurisdictionIso3:
          row.administering_jurisdiction_iso3 == null
            ? null
            : String(row.administering_jurisdiction_iso3),
        statusDisputed: Boolean(row.status_disputed),
      });
      const passageId = String(row.passage_id);
      const anchorId = String(row.anchor_id);
      const slug = String(row.slug);
      const sourceDocumentId = String(row.source_document_id);
      const year = row.year == null ? null : Number(row.year);
      const yearUpdated =
        row.year_updated == null ? null : Number(row.year_updated);
      const documentContext = constitutionDocumentContext(
        sourceDocumentId,
        year,
        yearUpdated,
      );
      return {
        passageId,
        readerUrl: `/constitution?c=${encodeURIComponent(slug)}#${encodeURIComponent(anchorId)}`,
        citationUrl: `/api/constitution/passages/${passageId.slice("constitution-passage/".length)}`,
        rank: Number(row.rank),
        jurisdiction: {
          id: String(row.jurisdiction_id),
          slug,
          name: String(row.name),
          iso2: row.iso2 == null ? null : String(row.iso2),
          iso3: row.iso3 == null ? null : String(row.iso3),
          status: status.type,
          statusLabel: status.label,
          disputed: status.disputed,
        },
        constitution: {
          id: String(row.constitution_id),
          sourceDocumentId,
          year,
          yearUpdated,
          ...documentContext,
        },
        passage: {
          sourceSectionId: String(row.source_section_id),
          anchorId,
          headingLabel:
            row.heading_label == null ? null : String(row.heading_label),
          topicKeys: row.topic_keys as string[],
          language: {
            code: "en",
            basis: CONSTITUTION_PASSAGE_LANGUAGE_BASIS,
            translationStatus: CONSTITUTION_PASSAGE_TRANSLATION_STATUS,
            originalLanguageCode: null,
            translator: null,
          },
          highlightSegments: parseConstitutionSearchHighlight(
            String(row.headline),
          ),
        },
        provenance: {
          sourceId: SOURCE_ID,
          sourceName: "Constitute Project",
          sourceUrl: String(row.source_url),
          retrievalUrl: String(row.retrieval_url),
          licenseId: "CC-BY-NC-3.0",
          termsUrl: TERMS_URL,
          retrievedAt: iso(row.retrieved_at)!,
          contentSha256: String(row.content_sha256),
        },
      };
    });

    const last = data.at(-1);
    return {
      schemaVersion: CONSTITUTION_SEARCH_SCHEMA_VERSION,
      state: data.length > 0 ? "ok" : "no_results",
      query: {
        raw: input.query,
        normalized,
        language: "en",
        rankingMethod: CONSTITUTION_SEARCH_RANKING_METHOD,
      },
      filters: {
        jurisdictions: input.jurisdictions,
        topics: input.topics,
        topicMode: "any",
      },
      data,
      pagination: {
        limit: input.limit,
        hasMore,
        nextCursor:
          hasMore && last
            ? encodeCursor({
                version: 1,
                fingerprint: cursorFingerprint,
                rank: last.rank,
                passageId: last.passageId,
              })
            : null,
      },
      corpus: {
        indexVersion: CONSTITUTION_SEARCH_INDEX_VERSION,
        sourceId: SOURCE_ID,
        sourceLastSyncedAt,
      },
      rights: {
        access: "interactive-noncommercial-display-only",
        bulkExport: "blocked",
        licenseId: "CC-BY-NC-3.0",
        termsUrl: TERMS_URL,
      },
    };
  } catch (error) {
    if (error instanceof ConstitutionSearchQueryError) {
      throw error;
    }
    const dbError = error as { code?: string; message?: string };
    if (
      dbError.code === "57014" ||
      /statement timeout/i.test(dbError.message ?? "")
    ) {
      throw new ConstitutionSearchQueryError(
        "query_timeout",
        "The constitution search exceeded its one-second database limit.",
        504,
      );
    }
    throw new ConstitutionSearchQueryError(
      "data_unavailable",
      "The constitution search index is unavailable.",
      503,
    );
  }
}
