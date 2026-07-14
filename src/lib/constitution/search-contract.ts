import { z } from "zod";
import { CONSTITUTION_SEARCH_INDEX_VERSION } from "./passage-contract";

export const CONSTITUTION_SEARCH_SCHEMA_VERSION =
  "constitution-search/v1" as const;
export const CONSTITUTION_SEARCH_RANKING_METHOD =
  "postgres-websearch-english-ts-rank-cd/v1" as const;
export const CONSTITUTION_SEARCH_DEFAULT_LIMIT = 20;
export const CONSTITUTION_SEARCH_MAX_LIMIT = 50;
export const CONSTITUTION_SEARCH_MAX_QUERY_BYTES = 256;
export const CONSTITUTION_SEARCH_MAX_JURISDICTIONS = 20;
export const CONSTITUTION_SEARCH_MAX_TOPICS = 10;

export type ConstitutionSearchState = "ok" | "no_results";
export type ConstitutionSearchErrorCode =
  | "invalid_request"
  | "query_not_searchable"
  | "jurisdiction_not_covered"
  | "cursor_stale"
  | "rate_limited"
  | "rights_not_ready"
  | "data_unavailable"
  | "query_timeout";

export type ConstitutionSearchProtectionCode =
  "RATE_LIMITED" | "RATE_LIMIT_UNAVAILABLE";

export interface ConstitutionSearchInput {
  query: string;
  jurisdictions: string[];
  topics: string[];
  language: "en";
  limit: number;
  cursor: string | null;
}

export interface ConstitutionSearchHighlightSegment {
  text: string;
  highlighted: boolean;
}

export interface ConstitutionSearchResult {
  passageId: string;
  readerUrl: string;
  citationUrl: string;
  rank: number;
  jurisdiction: {
    id: string;
    slug: string;
    name: string;
    iso2: string | null;
    iso3: string | null;
    status: string;
    statusLabel: string;
    disputed: boolean;
  };
  constitution: {
    id: string;
    sourceDocumentId: string;
    year: number | null;
    yearUpdated: number | null;
    documentNature: "single-document" | "publisher-composite-collection";
    dateLabel: string;
  };
  passage: {
    sourceSectionId: string;
    anchorId: string;
    headingLabel: string | null;
    topicKeys: string[];
    language: {
      code: "en";
      basis: "constitute-service-lang-parameter";
      translationStatus: "publisher-supplied-language-version-translation-status-unknown";
      originalLanguageCode: null;
      translator: null;
    };
    highlightSegments: ConstitutionSearchHighlightSegment[];
  };
  provenance: {
    sourceId: "constitute_project";
    sourceName: "Constitute Project";
    sourceUrl: string;
    retrievalUrl: string;
    licenseId: "CC-BY-NC-3.0";
    termsUrl: string;
    retrievedAt: string;
    contentSha256: string;
  };
}

export interface ConstitutionSearchResponse {
  schemaVersion: typeof CONSTITUTION_SEARCH_SCHEMA_VERSION;
  state: ConstitutionSearchState;
  query: {
    raw: string;
    normalized: string;
    language: "en";
    rankingMethod: typeof CONSTITUTION_SEARCH_RANKING_METHOD;
  };
  filters: {
    jurisdictions: string[];
    topics: string[];
    topicMode: "any";
  };
  data: ConstitutionSearchResult[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  corpus: {
    indexVersion: typeof CONSTITUTION_SEARCH_INDEX_VERSION;
    sourceId: "constitute_project";
    sourceLastSyncedAt: string | null;
  };
  rights: {
    access: "interactive-noncommercial-display-only";
    bulkExport: "blocked";
    licenseId: "CC-BY-NC-3.0";
    termsUrl: string;
  };
}

export interface ConstitutionSearchErrorResponse {
  schemaVersion: typeof CONSTITUTION_SEARCH_SCHEMA_VERSION;
  error: ConstitutionSearchErrorCode;
  /** Stable shared-protection code on rate-limit 429/503 responses only. */
  code?: ConstitutionSearchProtectionCode;
  message: string;
  details?: { uncoveredJurisdictions: string[] };
}

const slug = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/);
const topic = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_-]+$/i);

export const constitutionSearchInputSchema = z
  .object({
    query: z.string().trim().min(2),
    jurisdictions: z
      .array(slug)
      .max(CONSTITUTION_SEARCH_MAX_JURISDICTIONS)
      .default([]),
    topics: z.array(topic).max(CONSTITUTION_SEARCH_MAX_TOPICS).default([]),
    language: z.literal("en").default("en"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(CONSTITUTION_SEARCH_MAX_LIMIT)
      .default(CONSTITUTION_SEARCH_DEFAULT_LIMIT),
    cursor: z.string().min(1).max(2048).nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      Buffer.byteLength(value.query, "utf8") >
      CONSTITUTION_SEARCH_MAX_QUERY_BYTES
    ) {
      context.addIssue({
        code: "custom",
        path: ["query"],
        message: `Query must be at most ${CONSTITUTION_SEARCH_MAX_QUERY_BYTES} UTF-8 bytes`,
      });
    }
    if (new Set(value.jurisdictions).size !== value.jurisdictions.length) {
      context.addIssue({
        code: "custom",
        path: ["jurisdictions"],
        message: "Jurisdiction filters must be unique",
      });
    }
    if (new Set(value.topics).size !== value.topics.length) {
      context.addIssue({
        code: "custom",
        path: ["topics"],
        message: "Topic filters must be unique",
      });
    }
  });

export const normalizeConstitutionSearchQuery = (query: string): string =>
  query.normalize("NFKC").replace(/\s+/gu, " ").trim();

export function constitutionDocumentContext(
  sourceDocumentId: string,
  year: number | null,
  yearUpdated: number | null,
): Pick<
  ConstitutionSearchResult["constitution"],
  "documentNature" | "dateLabel"
> {
  if (sourceDocumentId === "United_Kingdom_2013") {
    return {
      documentNature: "publisher-composite-collection",
      dateLabel: "Source collection spans 1215–2013",
    };
  }
  return {
    documentNature: "single-document",
    dateLabel:
      year && yearUpdated && year !== yearUpdated
        ? `Enacted ${year} · source tracks amendments through ${yearUpdated}`
        : year
          ? `Enacted ${year}`
          : yearUpdated
            ? `Source tracks amendments through ${yearUpdated}`
            : "Document date unavailable",
  };
}
