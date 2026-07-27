/**
 * ATL-009 pre-implementation, read-only constitution corpus validator.
 *
 * This script intentionally does not create or mutate a search relation. It
 * freezes the audited live corpus and reports whether a future relation has
 * appeared. A missing relation is the expected `not_applied` feature state at
 * this checkpoint, not evidence that constitutional search is complete.
 */

import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("ATL-009 corpus validation requires DATABASE_URL in .env.local.");
  process.exit(1);
}

const sql = neon(databaseUrl);

const EXPECTED = {
  documents: 186,
  jurisdictions: 186,
  sections: 96_127,
  excerpts: 30_537,
  topics: 329,
  catalogJurisdictions: 253,
  sovereignCatalog: 194,
  coveredSovereigns: 183,
  missingSovereigns: 11,
  statementDocuments: 20,
  missingStatementDocuments: 166,
  missingHeadings: 20,
  emptySectionHtml: 1,
  missingArticleLabels: 1,
} as const;

function numeric(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a number, received ${String(value)}`);
  return parsed;
}

function check(label: string, actual: number, expected: number, failures: string[]) {
  if (actual !== expected) failures.push(`${label}: expected ${expected}, received ${actual}`);
}

async function main() {
  const [corpusRows, sectionRows, excerptRows, provenanceRows, indexRows, relationRows] =
    await Promise.all([
      sql`
        SELECT
          count(*) AS documents,
          count(DISTINCT c.jurisdiction_id) AS jurisdictions,
          count(*) FILTER (WHERE j.type = 'sovereign_state') AS covered_sovereigns,
          (SELECT count(*) FROM jurisdictions) AS catalog_jurisdictions,
          (SELECT count(*) FROM jurisdictions WHERE type = 'sovereign_state') AS sovereign_catalog,
          (SELECT count(*) FROM jurisdictions j2
            WHERE j2.type = 'sovereign_state'
              AND NOT EXISTS (
                SELECT 1 FROM constitutions c2 WHERE c2.jurisdiction_id = j2.id
              )) AS missing_sovereigns,
          count(*) FILTER (WHERE c.year_updated IS NULL) AS missing_amendment_year,
          count(*) FILTER (WHERE c.full_text_html IS NULL OR btrim(c.full_text_html) = '') AS empty_documents,
          count(*) FILTER (WHERE c.structured_articles IS NULL
            OR jsonb_typeof(c.structured_articles) <> 'array'
            OR jsonb_array_length(c.structured_articles) = 0) AS empty_structured_documents,
          count(*) FILTER (WHERE c.full_text_html ~* '<html[^>]+lang=') AS html_language_markers
        FROM constitutions c
        JOIN jurisdictions j ON j.id = c.jurisdiction_id
      `,
      sql`
        WITH sections AS (
          SELECT
            c.id AS constitution_id,
            j.slug,
            article.elem,
            concat(
              'sec-',
              regexp_replace(article.elem->>'sectionId', '[^a-zA-Z0-9]+', '-', 'g')
            ) AS dom_id
          FROM constitutions c
          JOIN jurisdictions j ON j.id = c.jurisdiction_id
          CROSS JOIN LATERAL jsonb_array_elements(c.structured_articles) article(elem)
        ), raw_duplicates AS (
          SELECT constitution_id, elem->>'sectionId' AS section_id
          FROM sections
          GROUP BY constitution_id, elem->>'sectionId'
          HAVING count(*) > 1
        ), dom_collisions AS (
          SELECT constitution_id, dom_id
          FROM sections
          GROUP BY constitution_id, dom_id
          HAVING count(*) > 1
        )
        SELECT
          count(*) AS sections,
          count(*) FILTER (WHERE coalesce(elem->>'sectionId', '') = '') AS missing_section_ids,
          count(*) FILTER (WHERE coalesce(elem->>'headingLabel', '') = '') AS missing_headings,
          count(*) FILTER (WHERE coalesce(elem->>'html', '') = '') AS empty_section_html,
          (SELECT count(*) FROM raw_duplicates) AS duplicate_section_id_groups,
          (SELECT count(*) FROM dom_collisions) AS dom_anchor_collision_groups
        FROM sections
      `,
      sql`
        WITH section_ids AS (
          SELECT c.id AS constitution_id, article.elem->>'sectionId' AS section_id
          FROM constitutions c
          CROSS JOIN LATERAL jsonb_array_elements(c.structured_articles) article(elem)
        ), duplicate_excerpts AS (
          SELECT constitution_id, topic_key, section_id
          FROM constitution_topic_excerpts
          GROUP BY constitution_id, topic_key, section_id
          HAVING count(*) > 1
        ), label_drift AS (
          SELECT topic_key
          FROM constitution_topic_excerpts
          GROUP BY topic_key
          HAVING count(DISTINCT topic_label) > 1
        )
        SELECT
          count(*) AS excerpts,
          count(DISTINCT e.topic_key) AS topics,
          count(*) FILTER (WHERE e.excerpt_html IS NULL OR btrim(e.excerpt_html) = '') AS empty_excerpts,
          count(*) FILTER (WHERE e.article_label IS NULL) AS missing_article_labels,
          count(*) FILTER (WHERE s.section_id IS NULL) AS orphan_section_references,
          (SELECT count(*) FROM duplicate_excerpts) AS duplicate_excerpt_groups,
          (SELECT count(*) FROM label_drift) AS topic_label_drift_keys
        FROM constitution_topic_excerpts e
        LEFT JOIN section_ids s
          ON s.constitution_id = e.constitution_id
         AND s.section_id = e.section_id
      `,
      sql`
        SELECT
          count(DISTINCT c.id) FILTER (WHERE s.id IS NOT NULL) AS statement_documents,
          count(DISTINCT c.id) FILTER (WHERE s.id IS NULL) AS missing_statement_documents,
          count(*) FILTER (WHERE s.id IS NOT NULL AND s.source_hash IS NOT NULL) AS statements_with_hash,
          count(*) FILTER (
            WHERE s.id IS NOT NULL
              AND s.source_url IS DISTINCT FROM concat(
                'https://www.constituteproject.org/constitution/',
                c.constitute_project_id
              )
          ) AS stale_statement_urls
        FROM constitutions c
        LEFT JOIN statements s
          ON s.subject_table = 'constitutions'
         AND s.subject_id = c.id
         AND s.source_id = 'constitute_project'
      `,
      sql`
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('constitutions', 'constitution_topic_excerpts', 'constitution_passages')
        ORDER BY tablename, indexname
      `,
      sql`
        SELECT to_regclass('public.constitution_passages')::text AS relation
      `,
    ]);

  const corpus = corpusRows[0];
  const sections = sectionRows[0];
  const excerpts = excerptRows[0];
  const provenance = provenanceRows[0];
  const failures: string[] = [];

  check("documents", numeric(corpus.documents), EXPECTED.documents, failures);
  check("jurisdictions", numeric(corpus.jurisdictions), EXPECTED.jurisdictions, failures);
  check("covered sovereigns", numeric(corpus.covered_sovereigns), EXPECTED.coveredSovereigns, failures);
  check("catalog jurisdictions", numeric(corpus.catalog_jurisdictions), EXPECTED.catalogJurisdictions, failures);
  check("sovereign catalog", numeric(corpus.sovereign_catalog), EXPECTED.sovereignCatalog, failures);
  check("missing sovereigns", numeric(corpus.missing_sovereigns), EXPECTED.missingSovereigns, failures);
  check("structured sections", numeric(sections.sections), EXPECTED.sections, failures);
  check("topic excerpts", numeric(excerpts.excerpts), EXPECTED.excerpts, failures);
  check("topic keys", numeric(excerpts.topics), EXPECTED.topics, failures);
  check("missing headings", numeric(sections.missing_headings), EXPECTED.missingHeadings, failures);
  check("empty section HTML", numeric(sections.empty_section_html), EXPECTED.emptySectionHtml, failures);
  check("missing article labels", numeric(excerpts.missing_article_labels), EXPECTED.missingArticleLabels, failures);
  check("statement documents", numeric(provenance.statement_documents), EXPECTED.statementDocuments, failures);
  check(
    "documents without statements",
    numeric(provenance.missing_statement_documents),
    EXPECTED.missingStatementDocuments,
    failures,
  );

  const zeroInvariants: Array<[string, unknown]> = [
    ["empty full-text documents", corpus.empty_documents],
    ["empty structured documents", corpus.empty_structured_documents],
    ["HTML language markers", corpus.html_language_markers],
    ["missing section IDs", sections.missing_section_ids],
    ["duplicate section-ID groups", sections.duplicate_section_id_groups],
    ["generated DOM-anchor collisions", sections.dom_anchor_collision_groups],
    ["empty excerpts", excerpts.empty_excerpts],
    ["orphan excerpt section references", excerpts.orphan_section_references],
    ["duplicate excerpt groups", excerpts.duplicate_excerpt_groups],
    ["topic-label drift keys", excerpts.topic_label_drift_keys],
    ["statements with source hashes", provenance.statements_with_hash],
  ];
  for (const [label, value] of zeroInvariants) check(label, numeric(value), 0, failures);
  check("stale statement URLs", numeric(provenance.stale_statement_urls), 2, failures);

  const searchRelation = relationRows[0]?.relation ?? null;
  let passageState: Record<string, unknown> | null = null;
  if (searchRelation) {
    const passageRows = await sql`
      SELECT
        count(*) FILTER (WHERE is_current)::int AS current_passages,
        count(*) FILTER (WHERE NOT is_current)::int AS superseded_passages,
        count(DISTINCT constitution_id) FILTER (WHERE is_current)::int AS indexed_constitutions,
        count(*) FILTER (
          WHERE (is_current AND superseded_at IS NOT NULL)
             OR (NOT is_current AND superseded_at IS NULL)
        )::int AS invalid_supersession_rows
      FROM constitution_passages
    `;
    passageState = passageRows[0] ?? null;
    check(
      "current constitution passages",
      numeric(passageState?.current_passages),
      EXPECTED.sections - EXPECTED.emptySectionHtml,
      failures,
    );
    check(
      "indexed constitutions",
      numeric(passageState?.indexed_constitutions),
      EXPECTED.documents,
      failures,
    );
    check(
      "invalid passage supersession rows",
      numeric(passageState?.invalid_supersession_rows),
      0,
      failures,
    );
    for (const requiredIndex of [
      "idx_constitution_passages_current_section",
      "idx_constitution_passages_search",
      "idx_constitution_passages_topics",
    ]) {
      if (!indexRows.some((row) => row.indexname === requiredIndex)) {
        failures.push(`missing constitution passage index: ${requiredIndex}`);
      }
    }
  }
  const featureState = !searchRelation
    ? "not_applied"
    : failures.length === 0
      ? "applied_verified"
      : "relation_present_invalid";
  const report = {
    schemaVersion: "atl-009-constitution-search-corpus-validation/v1",
    featureState,
    corpus: {
      documents: numeric(corpus.documents),
      jurisdictions: numeric(corpus.jurisdictions),
      sections: numeric(sections.sections),
      excerpts: numeric(excerpts.excerpts),
      topics: numeric(excerpts.topics),
      sovereignCoverage: `${numeric(corpus.covered_sovereigns)}/${numeric(corpus.sovereign_catalog)} (94.3%)`,
    },
    languageBoundary: {
      ingestLanguage: "en",
      htmlLanguageMarkers: numeric(corpus.html_language_markers),
      translationStatus: "unknown-not-stored",
    },
    provenance: {
      statementDocuments: numeric(provenance.statement_documents),
      documentsWithoutStatements: numeric(provenance.missing_statement_documents),
      sourceHashes: numeric(provenance.statements_with_hash),
      staleStatementUrls: numeric(provenance.stale_statement_urls),
    },
    anchorCollisionGroups: numeric(sections.dom_anchor_collision_groups),
    currentIndexes: indexRows.map((row) => `${row.tablename}.${row.indexname}`),
    searchRelation,
    passageState,
    failures,
  };

  console.log(JSON.stringify(report, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("ATL-009 corpus validation failed:", error);
  process.exit(1);
});
