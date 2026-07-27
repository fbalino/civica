import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "./index";
import {
  constitutions,
  constitutionTopicExcerpts,
  jurisdictions,
} from "./schema";
import {
  sanitizeConstitutionHtml,
  type SanitizedConstitutionHtml,
} from "@/lib/constitution/sanitize-html";

// ---------------------------------------------------------------------------
// Constitution Explorer — read layer (Wave 2, Phase 2b).
//
// Backs the standalone `/constitution` page. Three read paths, all soft-failing
// (try/catch → null/[]) like the rest of the reader pages so the page renders
// coherently when the DB is unreachable:
//
//   getConstitutionWithArticles(slug)  — one country's structured articles + meta
//   getTopicExcerpts(topicKey, ids[])  — cross-reference passages for the pane
//   getIndexedConstitutionCountries()  — which of the 253 jurisdictions have text
//
// All data is our own Constitute-derived DB (constitutions.structured_articles
// + constitution_topic_excerpts, built at ingest time). No live Constitute
// calls happen at page view — the cross-reference pane is a pure indexed query.
//
// Source: Elkins, Ginsburg & Melton, "Constitute: The World's Constitutions to
// Read, Search, and Compare" (constituteproject.org, CC BY-NC 3.0).
// ---------------------------------------------------------------------------

/** One parsed section of a constitution, as stored in `structured_articles`. */
export interface ConstitutionArticle {
  /** Constitute section id, e.g. `section/8`. Stable within a constitution. */
  sectionId: string;
  /** Nearest ancestor article/title heading, e.g. "ARTICLE 1" or "Preamble". */
  headingLabel: string;
  /** Constitute ontology leaf keys tagged on this section (may be empty). */
  topics: string[];
  /** Server-sanitized section HTML under the constitution-html/v1 contract. */
  html: SanitizedConstitutionHtml;
}

/** A country whose constitution is fully indexed (has structured articles). */
export interface IndexedConstitutionCountry {
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  /** Year the constitution was enacted (null if unknown). */
  year: number | null;
  /** Year of the most recent amendment Constitute tracked (null if none). */
  yearUpdated: number | null;
}

/** A single country's full constitution + jurisdiction metadata. */
export interface ConstitutionDetail {
  jurisdictionId: string;
  slug: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  constituteProjectId: string | null;
  year: number | null;
  yearUpdated: number | null;
  lastFetched: string | null;
  articles: ConstitutionArticle[];
}

/** One cross-reference excerpt, grouped under a peer country. */
export interface TopicExcerptCountry {
  jurisdictionId: string;
  slug: string;
  name: string;
  iso2: string | null;
  /** Passages in this country's constitution tagged with the requested topic. */
  excerpts: Array<{
    sectionId: string | null;
    articleLabel: string | null;
    /** Server-sanitized excerpt HTML under the constitution-html/v1 contract. */
    excerptHtml: SanitizedConstitutionHtml;
  }>;
}

export interface ConstitutionQueryOptions {
  /** Re-throw database failures so an API route can return 503, not 200 + []. */
  throwOnError?: boolean;
}

function coerceArticles(raw: unknown): ConstitutionArticle[] {
  if (!Array.isArray(raw)) return [];
  const out: ConstitutionArticle[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const rawHtml = typeof e.html === "string" ? e.html : "";
    if (!rawHtml) continue;
    const html = sanitizeConstitutionHtml(rawHtml);
    if (!html) continue;
    out.push({
      sectionId: typeof e.sectionId === "string" ? e.sectionId : "",
      headingLabel:
        typeof e.headingLabel === "string" && e.headingLabel.trim()
          ? e.headingLabel
          : "",
      topics: Array.isArray(e.topics)
        ? e.topics.filter((t): t is string => typeof t === "string")
        : [],
      html,
    });
  }
  return out;
}

/**
 * Full constitution for a country by civica slug, including parsed articles.
 * Returns null when the slug is unknown or the country has no ingested
 * constitution. By default a database failure also soft-fails to null for the
 * standalone Explorer; country-reader callers may request the error so they
 * can distinguish an outage from an unindexed document.
 */
export async function getConstitutionWithArticles(
  slug: string,
  options: ConstitutionQueryOptions = {},
): Promise<ConstitutionDetail | null> {
  try {
    const rows = await db
      .select({
        jurisdictionId: jurisdictions.id,
        slug: jurisdictions.slug,
        name: jurisdictions.name,
        iso2: jurisdictions.iso2,
        iso3: jurisdictions.iso3,
        constituteProjectId: constitutions.constituteProjectId,
        year: constitutions.year,
        yearUpdated: constitutions.yearUpdated,
        lastFetched: constitutions.lastFetched,
        structuredArticles: constitutions.structuredArticles,
      })
      .from(constitutions)
      .innerJoin(
        jurisdictions,
        eq(constitutions.jurisdictionId, jurisdictions.id),
      )
      .where(eq(jurisdictions.slug, slug))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    const articles = coerceArticles(row.structuredArticles);
    if (articles.length === 0) return null;

    return {
      jurisdictionId: row.jurisdictionId,
      slug: row.slug,
      name: row.name,
      iso2: row.iso2,
      iso3: row.iso3,
      constituteProjectId: row.constituteProjectId,
      year: row.year,
      yearUpdated: row.yearUpdated,
      lastFetched: row.lastFetched ? row.lastFetched.toISOString() : null,
      articles,
    };
  } catch (err) {
    console.error("[queries-constitution] getConstitutionWithArticles:", err);
    if (options.throwOnError) throw err;
    return null;
  }
}

/**
 * Cross-reference excerpts for a topic across a set of jurisdictions, grouped
 * by country. Preserves the caller's `jurisdictionIds` order (so the reader's
 * chosen peer order is respected) and drops countries with no matching
 * excerpt. Returns [] on any error / empty input.
 */
export async function getTopicExcerpts(
  topicKey: string,
  jurisdictionIds: string[],
  options: ConstitutionQueryOptions = {},
): Promise<TopicExcerptCountry[]> {
  if (!topicKey || jurisdictionIds.length === 0) return [];
  try {
    const rows = await db
      .select({
        jurisdictionId: constitutionTopicExcerpts.jurisdictionId,
        slug: jurisdictions.slug,
        name: jurisdictions.name,
        iso2: jurisdictions.iso2,
        sectionId: constitutionTopicExcerpts.sectionId,
        articleLabel: constitutionTopicExcerpts.articleLabel,
        excerptHtml: constitutionTopicExcerpts.excerptHtml,
      })
      .from(constitutionTopicExcerpts)
      .innerJoin(
        jurisdictions,
        eq(constitutionTopicExcerpts.jurisdictionId, jurisdictions.id),
      )
      .where(
        and(
          eq(constitutionTopicExcerpts.topicKey, topicKey),
          inArray(constitutionTopicExcerpts.jurisdictionId, jurisdictionIds),
        ),
      );

    // Group by jurisdiction, keeping the caller's requested order.
    const byId = new Map<string, TopicExcerptCountry>();
    for (const r of rows) {
      const excerptHtml = sanitizeConstitutionHtml(r.excerptHtml);
      if (!excerptHtml) continue;
      let entry = byId.get(r.jurisdictionId);
      if (!entry) {
        entry = {
          jurisdictionId: r.jurisdictionId,
          slug: r.slug,
          name: r.name,
          iso2: r.iso2,
          excerpts: [],
        };
        byId.set(r.jurisdictionId, entry);
      }
      // Cap excerpts per country so one verbose constitution can't flood the
      // pane; the reader opens the full country to read everything.
      if (entry.excerpts.length < 8) {
        entry.excerpts.push({
          sectionId: r.sectionId,
          articleLabel: r.articleLabel,
          excerptHtml,
        });
      }
    }

    return jurisdictionIds
      .map((id) => byId.get(id))
      .filter((e): e is TopicExcerptCountry => e != null);
  } catch (err) {
    console.error("[queries-constitution] getTopicExcerpts:", err);
    if (options.throwOnError) throw err;
    return [];
  }
}

/**
 * The set of jurisdictions with a fully-indexed constitution (structured
 * articles present). ~186 of 253. Ordered by population desc then name here;
 * the constitution page re-sorts alphabetically for display, so this ordering
 * is only the raw fetch order. Returns [] on error unless `throwOnError` is
 * requested by a caller that must distinguish outage from a genuine empty set.
 */
export async function getIndexedConstitutionCountries(
  options: {
    throwOnError?: boolean;
  } = {},
): Promise<IndexedConstitutionCountry[]> {
  try {
    const rows = await db
      .select({
        slug: jurisdictions.slug,
        name: jurisdictions.name,
        iso2: jurisdictions.iso2,
        iso3: jurisdictions.iso3,
        year: constitutions.year,
        yearUpdated: constitutions.yearUpdated,
      })
      .from(constitutions)
      .innerJoin(
        jurisdictions,
        eq(constitutions.jurisdictionId, jurisdictions.id),
      )
      .where(isNotNull(constitutions.structuredArticles))
      .orderBy(
        sql`${jurisdictions.population} DESC NULLS LAST`,
        jurisdictions.name,
      );
    return rows;
  } catch (err) {
    console.error(
      "[queries-constitution] getIndexedConstitutionCountries:",
      err,
    );
    if (options.throwOnError) throw err;
    return [];
  }
}

/**
 * A few "notable peers" for a topic when the reader has only one country
 * selected — the countries (other than the reader's) with the largest excerpt
 * for the topic, so the intro comparison shows substantive passages rather than
 * one-line stubs. Best-effort; returns [] on error.
 */
export async function getNotableTopicPeers(
  topicKey: string,
  excludeJurisdictionId: string,
  limit = 3,
  options: ConstitutionQueryOptions = {},
): Promise<TopicExcerptCountry[]> {
  if (!topicKey) return [];
  try {
    const rows = await db
      .select({
        jurisdictionId: constitutionTopicExcerpts.jurisdictionId,
        slug: jurisdictions.slug,
        name: jurisdictions.name,
        iso2: jurisdictions.iso2,
        sectionId: constitutionTopicExcerpts.sectionId,
        articleLabel: constitutionTopicExcerpts.articleLabel,
        excerptHtml: constitutionTopicExcerpts.excerptHtml,
        len: sql<number>`length(${constitutionTopicExcerpts.excerptHtml})`,
      })
      .from(constitutionTopicExcerpts)
      .innerJoin(
        jurisdictions,
        eq(constitutionTopicExcerpts.jurisdictionId, jurisdictions.id),
      )
      .where(
        and(
          eq(constitutionTopicExcerpts.topicKey, topicKey),
          ne(constitutionTopicExcerpts.jurisdictionId, excludeJurisdictionId),
        ),
      )
      .orderBy(sql`length(${constitutionTopicExcerpts.excerptHtml}) DESC`)
      .limit(limit * 4);

    // Take the single longest excerpt per country, then the top `limit`.
    const byId = new Map<string, TopicExcerptCountry>();
    for (const r of rows) {
      if (byId.has(r.jurisdictionId)) continue;
      const excerptHtml = sanitizeConstitutionHtml(r.excerptHtml);
      if (!excerptHtml) continue;
      byId.set(r.jurisdictionId, {
        jurisdictionId: r.jurisdictionId,
        slug: r.slug,
        name: r.name,
        iso2: r.iso2,
        excerpts: [
          {
            sectionId: r.sectionId,
            articleLabel: r.articleLabel,
            excerptHtml,
          },
        ],
      });
      if (byId.size >= limit) break;
    }
    return [...byId.values()];
  } catch (err) {
    console.error("[queries-constitution] getNotableTopicPeers:", err);
    if (options.throwOnError) throw err;
    return [];
  }
}
