import { sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  GOVERNANCE_EVIDENCE_RELEASE_ID,
  GOVERNANCE_EVIDENCE_YEAR,
} from "@/lib/ci/governance-evidence";
import {
  PAGE_FINGERPRINT_VERSION,
  type CurrentFingerprints,
  type PageRebuildEntry,
  type StoredFingerprint,
} from "@/lib/platform/page-rebuild-plan";

/**
 * APR-D179 — content fingerprints of the database rows each cached page group
 * renders (dependency map `page-fingerprint/v1`).
 *
 * Fingerprints are computed from row CONTENT, never from bookkeeping
 * timestamps: many tables have no reliable `updated_at` and some writers
 * bump it on no-op upserts. Each component is an MD5 over the ordered JSON
 * text of its rows, with only columns that are never rendered removed
 * (`updated_at`, `created_at`, `fact_cache_refreshed_at`, and similar).
 * Timestamps that a page does render, such as `country_facts.retrieved_at`
 * and `statements.retrieved_at`, stay in the fingerprint.
 *
 * A code or checked-in file change needs no fingerprint: every deployment
 * starts with an empty page cache.
 *
 * Country pages (layout + Factbook, Civica Data, and Constitution tabs):
 * jurisdictions, government_taxonomies, country_facts, data_disputes
 * (open/in review), entity_name_forms (current), country_factbook_sections,
 * ci_research_panel_rows (governance-evidence release and year),
 * indicator_history, government_bodies, offices, terms, persons, statements
 * (about the jurisdiction, its bodies, terms, elections, and constitution),
 * bills, organization memberships (the country's, plus every membership and
 * organization row of the organizations it belongs to or hosts),
 * ci_dimension_scores, current legislature_parties, party_composition_runs,
 * elections, election_results, and constitutions.
 *
 * Global (every country page): the country list, the `sources` rows without
 * `last_sync_at` (no country page shows it), the Index release header and
 * pointers, and the Conditions release headers.
 *
 * Non-country pages have no fingerprint: they read many tables across the
 * site, so they are rebuilt on every nightly run instead.
 */

/** Row text with only never-rendered columns removed. */
function rowText(alias: string, dropped: readonly string[] = []): SQL {
  const drop = dropped.map((column) => ` - '${column}'`).join("");
  return sql.raw(`(to_jsonb(${alias})${drop})::text`);
}

function digest(alias: string, order: string, dropped: readonly string[] = []): SQL {
  return sql`md5(coalesce(string_agg(${rowText(alias, dropped)}, '|' ORDER BY ${sql.raw(order)}), ''))`;
}

const TIMESTAMPS = ["created_at", "updated_at"] as const;

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  return (
    Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
  ) as Array<Record<string, unknown>>;
}

export function countryFingerprintQuery(): SQL {
  return sql`
    WITH j AS (
      -- Same publication rule as the sitemap: a hidden jurisdiction is not a
      -- current country, so its slug is retired and its old URLs invalidated.
      SELECT id, slug FROM jurisdictions WHERE lower(name) <> 'none'
    ),
    bodies AS (
      SELECT b.* FROM government_bodies b
    ),
    office_rows AS (
      SELECT o.*, b.jurisdiction_id FROM offices o JOIN government_bodies b ON b.id = o.body_id
    ),
    term_rows AS (
      SELECT t.*, o.jurisdiction_id, p.name AS person_name, p.date_of_birth,
        p.wikidata_qid AS person_qid, p.photo_url, p.photo_license,
        p.photo_credit, p.parline_person_code
      FROM terms t
      JOIN office_rows o ON o.id = t.office_id
      LEFT JOIN persons p ON p.id = t.person_id
    ),
    election_rows AS (
      SELECT e.* FROM elections e
    ),
    subjects AS (
      SELECT id, id AS jurisdiction_id FROM jurisdictions
      UNION ALL SELECT id, jurisdiction_id FROM government_bodies
      UNION ALL SELECT id, jurisdiction_id FROM term_rows
      UNION ALL SELECT id, jurisdiction_id FROM elections
      UNION ALL SELECT id, jurisdiction_id FROM constitutions
    ),
    member_orgs AS (
      SELECT DISTINCT m.jurisdiction_id, m.org_id FROM organization_memberships m
      UNION
      SELECT j2.id, o.id FROM organizations o JOIN jurisdictions j2 ON j2.slug = o.hq_country
    ),
    parts AS (
      SELECT x.id AS jurisdiction_id, 'jurisdiction' AS part,
        ${digest("x", "x.id", ["fact_cache_refreshed_at", ...TIMESTAMPS])} AS d
        FROM jurisdictions x GROUP BY x.id
      UNION ALL SELECT x.jurisdiction_id, 'taxonomy',
        ${digest("x", "x.id", ["regime_retrieved_at", ...TIMESTAMPS])}
        FROM government_taxonomies x GROUP BY x.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'facts',
        ${digest("x", "x.id", TIMESTAMPS)}
        FROM country_facts x GROUP BY x.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'disputes',
        md5(coalesce(string_agg(x.fact_key || ':' || x.status, '|' ORDER BY x.fact_key, x.status), ''))
        FROM data_disputes x WHERE x.status IN ('open', 'in_review') GROUP BY x.jurisdiction_id
      UNION ALL SELECT x.entity_id, 'names',
        md5(coalesce(string_agg(x.name_role || ':' || x.language_tag || ':' || x.value, '|' ORDER BY x.name_role, x.language_tag, x.value), ''))
        FROM entity_name_forms x
        WHERE x.entity_type = 'jurisdiction' AND x.is_current GROUP BY x.entity_id
      UNION ALL SELECT x.jurisdiction_id, 'factbook',
        ${digest("x", "x.id", TIMESTAMPS)}
        FROM country_factbook_sections x GROUP BY x.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'governance-evidence',
        ${digest("x", "x.source_id, x.indicator_id, x.dimension")}
        FROM ci_research_panel_rows x
        WHERE x.release_id = ${GOVERNANCE_EVIDENCE_RELEASE_ID}
          AND x.period_year = ${GOVERNANCE_EVIDENCE_YEAR}
        GROUP BY x.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'indicator-history',
        ${digest("x", "x.id", ["created_at"])}
        FROM indicator_history x GROUP BY x.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'bodies',
        ${digest("x", "x.id")}
        FROM bodies x GROUP BY x.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'offices',
        ${digest("x", "x.id")}
        FROM office_rows x GROUP BY x.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'terms',
        ${digest("x", "x.id")}
        FROM term_rows x GROUP BY x.jurisdiction_id
      UNION ALL SELECT s.jurisdiction_id, 'statements',
        ${digest("x", "x.id", ["created_at"])}
        FROM statements x JOIN subjects s ON s.id = x.subject_id
        GROUP BY s.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'bills',
        ${digest("x", "x.id", ["created_at"])}
        FROM bills x GROUP BY x.jurisdiction_id
      UNION ALL SELECT mo.jurisdiction_id, 'organizations',
        md5(coalesce(string_agg(
          ${rowText("o", TIMESTAMPS)} || '#' || coalesce(m.rows, ''),
          '|' ORDER BY o.id), ''))
        FROM member_orgs mo
        JOIN organizations o ON o.id = mo.org_id
        LEFT JOIN LATERAL (
          SELECT string_agg(${rowText("m2", TIMESTAMPS)}, '|' ORDER BY m2.id) AS rows
          FROM organization_memberships m2 WHERE m2.org_id = o.id
        ) m ON true
        GROUP BY mo.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'index-scores',
        ${digest("x", "x.id", ["created_at"])}
        FROM ci_dimension_scores x GROUP BY x.jurisdiction_id
      UNION ALL SELECT b.jurisdiction_id, 'legislature',
        md5(coalesce(string_agg(concat_ws(':', x.id, x.body_id, x.party_id,
          x.party_name, x.party_color, x.seat_count, x.is_ruling_coalition,
          x.wikidata_qid), '|' ORDER BY x.id), ''))
        FROM legislature_parties x JOIN government_bodies b ON b.id = x.body_id
        WHERE x.is_current GROUP BY b.jurisdiction_id
      UNION ALL SELECT b.jurisdiction_id, 'composition-runs',
        md5(coalesce(string_agg(concat_ws(':', x.id, x.source_id,
          x.source_retrieved_at), '|' ORDER BY x.id), ''))
        FROM party_composition_runs x JOIN government_bodies b ON b.id = x.body_id
        GROUP BY b.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'elections',
        md5(coalesce(string_agg(${rowText("x", ["created_at"])} || '#' || coalesce(r.rows, ''), '|' ORDER BY x.id), ''))
        FROM election_rows x
        LEFT JOIN LATERAL (
          SELECT string_agg(${rowText("r2")}, '|' ORDER BY r2.id) AS rows
          FROM election_results r2 WHERE r2.election_id = x.id
        ) r ON true
        GROUP BY x.jurisdiction_id
      UNION ALL SELECT x.jurisdiction_id, 'constitution',
        md5(coalesce(string_agg(concat_ws(':', x.id, x.constitute_project_id,
          x.year, x.year_updated, x.last_fetched, md5(x.structured_articles::text)),
          '|' ORDER BY x.id), ''))
        FROM constitutions x GROUP BY x.jurisdiction_id
    )
    SELECT j.id AS jurisdiction_id, j.slug,
      md5(coalesce(string_agg(p.part || '=' || p.d, '|' ORDER BY p.part), '')) AS fingerprint
    FROM j LEFT JOIN parts p ON p.jurisdiction_id = j.id
    GROUP BY j.id, j.slug
    ORDER BY j.slug
  `;
}

export function globalFingerprintQuery(): SQL {
  return sql`
    SELECT md5(concat_ws('|',
      (SELECT md5(coalesce(string_agg(concat_ws(':', slug, name, iso2, iso3, type,
          status_source_ids::text, status_reviewed_at, status_note,
          administering_jurisdiction_iso3, status_disputed), '|' ORDER BY slug), ''))
        FROM jurisdictions WHERE lower(name) <> 'none'),
      (SELECT md5(coalesce(string_agg(${rowText("s", ["last_sync_at"])}, '|' ORDER BY s.id), ''))
        FROM sources s),
      (SELECT md5(coalesce(string_agg(${rowText("r", ["created_at"])}, '|' ORDER BY r.id), ''))
        FROM ci_index_releases r),
      (SELECT md5(coalesce(string_agg(p.product || ':' || p.release_id, '|' ORDER BY p.product), ''))
        FROM ci_index_release_pointers p),
      (SELECT md5(coalesce(string_agg(concat_ws(':', c.id, c.methodology_version,
          c.manifest_sha256, c.created_at), '|' ORDER BY c.created_at, c.id), ''))
        FROM civica_conditions_releases c)
    )) AS fingerprint
  `;
}

/** Compute the current fingerprints (two read-only statements). */
export async function readCurrentPageFingerprints(): Promise<CurrentFingerprints> {
  const [countries, global] = await Promise.all([
    db.execute(countryFingerprintQuery()),
    db.execute(globalFingerprintQuery()),
  ]);
  const globalValue = String(rowsOf(global)[0]?.fingerprint ?? "");
  if (!globalValue) {
    throw new Error("page fingerprint query returned no global value");
  }
  return {
    global: globalValue,
    countries: rowsOf(countries).map((row) => ({
      jurisdictionId: String(row.jurisdiction_id),
      slug: String(row.slug),
      fingerprint: String(row.fingerprint),
    })),
  };
}

export async function readStoredPageFingerprints(): Promise<
  Map<string, StoredFingerprint>
> {
  const result = await db.execute(sql`
    SELECT page_key, fingerprint, fingerprint_version FROM page_cache_fingerprints
  `);
  return new Map(
    rowsOf(result).map((row) => [
      String(row.page_key),
      {
        fingerprint: String(row.fingerprint),
        fingerprintVersion: String(row.fingerprint_version),
      },
    ]),
  );
}

/**
 * Upsert the fingerprints of groups that rebuilt successfully, in one
 * statement (Neon HTTP has no interactive transactions).
 */
export async function storePageFingerprints(
  entries: readonly PageRebuildEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const payload = JSON.stringify(
    entries.map((entry) => ({ k: entry.pageKey, v: entry.fingerprint })),
  );
  await db.execute(sql`
    INSERT INTO page_cache_fingerprints (page_key, fingerprint, fingerprint_version, rebuilt_at)
    SELECT input.k, input.v, ${PAGE_FINGERPRINT_VERSION}, now()
    FROM jsonb_to_recordset(${payload}::jsonb) AS input(k text, v text)
    ON CONFLICT (page_key) DO UPDATE SET
      fingerprint = EXCLUDED.fingerprint,
      fingerprint_version = EXCLUDED.fingerprint_version,
      rebuilt_at = EXCLUDED.rebuilt_at
  `);
}

/**
 * Forget the stored fingerprints of page groups that no longer exist (a
 * retired country slug). The table is an internal cache bookkeeping store,
 * not research evidence.
 */
export async function forgetPageFingerprints(
  pageKeys: readonly string[],
): Promise<void> {
  if (pageKeys.length === 0) return;
  await db.execute(sql`
    DELETE FROM page_cache_fingerprints
    WHERE page_key IN (
      SELECT jsonb_array_elements_text(${JSON.stringify(pageKeys)}::jsonb)
    )
  `);
}
