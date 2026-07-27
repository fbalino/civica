import { config } from "dotenv";

config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { inArray } from "drizzle-orm";
import * as dbSchema from "../src/lib/db/schema";
import {
  MEMBERSHIPS,
  ORGANIZATIONS,
  getMemberCount,
  getOrgMemberCountryFallback,
} from "../src/lib/data/international-organizations";
import {
  ORGANIZATION_DATABASE_SLUGS,
  ORGANIZATION_MEMBERSHIP_RELEASE_VERSION,
  ORGANIZATION_MEMBERSHIP_RETRIEVED_AT,
  ORGANIZATION_MEMBERSHIP_SOURCE_ID,
  ORGANIZATION_MEMBERSHIP_SOURCES,
  releaseOrganizationMembership,
} from "../src/lib/organizations/membership-release";
import { jurisdictions } from "../src/lib/db/schema";
import { markSourcesSyncedTransactionQuery } from "../src/lib/db/source-freshness";
import { resolveAtlasReleaseId } from "../src/lib/factbook/country-fact-history-writer";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const neonSql = neon(databaseUrl);
const db = drizzle({ client: neonSql, schema: dbSchema });
const APPLY = process.argv.includes("--apply");
const DRY_RUN = process.argv.includes("--dry-run") || !APPLY;
if (APPLY && process.argv.includes("--dry-run")) {
  throw new Error("Choose either --apply or --dry-run, not both");
}
const ATLAS_RELEASE_ID = APPLY
  ? resolveAtlasReleaseId(
      process.argv
        .find((arg) => arg.startsWith("--release-id="))
        ?.slice("--release-id=".length),
    )
  : null;
const retrievedAt = new Date(ORGANIZATION_MEMBERSHIP_RETRIEVED_AT);
const sourceLicense =
  "Mixed official-publisher terms; factual reference only; source content is not redistributed";

function yearDate(year: number | null): string | null {
  return year == null ? null : `${year}-01-01`;
}

async function main() {
  const countryIds = Array.from(
    new Set(MEMBERSHIPS.map((row) => row.countryId)),
  );
  const jurisdictionRows = await db
    .select({
      id: jurisdictions.id,
      iso3: jurisdictions.iso3,
      slug: jurisdictions.slug,
    })
    .from(jurisdictions)
    .where(
      inArray(
        jurisdictions.iso3,
        countryIds.map((id) => id.toUpperCase()),
      ),
    );
  const jurisdictionByIso3 = new Map(
    jurisdictionRows
      .filter((row): row is typeof row & { iso3: string } => row.iso3 != null)
      .map((row) => [row.iso3.toLowerCase(), row]),
  );
  const fallbackOnlyCountries = countryIds.filter(
    (id) => !jurisdictionByIso3.has(id) && getOrgMemberCountryFallback(id),
  );
  const missingCountries = countryIds.filter(
    (id) => !jurisdictionByIso3.has(id) && !getOrgMemberCountryFallback(id),
  );
  if (missingCountries.length > 0) {
    throw new Error(
      `Release references ${missingCountries.length} unresolved ISO3 ids: ${missingCountries.join(", ")}`,
    );
  }

  const missingSources = ORGANIZATIONS.filter(
    (org) => !ORGANIZATION_MEMBERSHIP_SOURCES[org.id],
  ).map((org) => org.id);
  const missingSlugs = ORGANIZATIONS.filter(
    (org) => !ORGANIZATION_DATABASE_SLUGS[org.id],
  ).map((org) => org.id);
  if (missingSources.length > 0 || missingSlugs.length > 0) {
    throw new Error(
      `Incomplete release registry (sources: ${missingSources.join(", ") || "none"}; slugs: ${missingSlugs.join(", ") || "none"})`,
    );
  }

  const current = MEMBERSHIPS.filter(
    (row) => row.status !== "withdrawn",
  ).length;
  const historical = MEMBERSHIPS.length - current;
  console.log("=== Organization membership release ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "APPLY"}`);
  console.log(`Release: ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION}`);
  console.log(`Organizations: ${ORGANIZATIONS.length}`);
  console.log(
    `Relationships: ${MEMBERSHIPS.length} (${current} current; ${historical} historical)`,
  );
  console.log(
    `DB relationships: ${MEMBERSHIPS.length - fallbackOnlyCountries.length} (${fallbackOnlyCountries.length} fallback-only entity)`,
  );
  console.log(
    `Roster posture: ${Object.values(ORGANIZATION_MEMBERSHIP_SOURCES).filter((s) => s.coverage === "complete").length} complete; ${Object.values(ORGANIZATION_MEMBERSHIP_SOURCES).filter((s) => s.coverage === "selected").length} selected`,
  );

  if (DRY_RUN) {
    console.log(
      "\nDry run complete. Re-run with --apply after the authoritative migration.",
    );
    return;
  }

  const organizationRows = ORGANIZATIONS.map((org) => {
    const source = ORGANIZATION_MEMBERSHIP_SOURCES[org.id];
    const hq = org.hqCountry
      ? jurisdictionByIso3.get(org.hqCountry.toLowerCase())
      : null;
    return {
      slug: ORGANIZATION_DATABASE_SLUGS[org.id],
      name: org.name,
      fullName: org.fullName,
      type: org.type,
      foundedYear: org.foundedYear,
      hqCountry: hq?.slug ?? null,
      memberCount: org.memberCount ?? getMemberCount(org.id),
      extra: org.extra ?? null,
      sourceUrl: source.url,
      sourceLicense: source.license,
    };
  });
  const membershipRows = MEMBERSHIPS.flatMap((membership) => {
    if (!jurisdictionByIso3.has(membership.countryId)) return [];
    const released = releaseOrganizationMembership(membership);
    return [
      {
        orgSlug: ORGANIZATION_DATABASE_SLUGS[membership.orgId],
        countryId: membership.countryId.toUpperCase(),
        joinDate: yearDate(released.joinYear),
        joinDatePrecision: released.joinDatePrecision,
        endDate: yearDate(released.endYear),
        endDatePrecision: released.endDatePrecision,
        role: membership.role ?? null,
        status: released.status,
        statusNote:
          released.status === "withdrawn"
            ? "Formal withdrawal retained as a historical membership interval."
            : null,
        disputed: false,
        sourceUrl: released.source.url,
        sourceLicense: released.source.license,
      },
    ];
  });

  const [releaseState] = await neonSql`
    WITH membership_input AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(membershipRows)}::jsonb) AS x(
        "orgSlug" text, "countryId" text, "joinDate" date,
        "joinDatePrecision" text, "endDate" date, "endDatePrecision" text,
        role text, status text, "statusNote" text, disputed boolean,
        "sourceUrl" text, "sourceLicense" text
      )
    ), organization_input AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(organizationRows)}::jsonb) AS x(
        slug text, name text, "fullName" text, type text, "foundedYear" integer,
        "hqCountry" text, "memberCount" integer, extra jsonb,
        "sourceUrl" text, "sourceLicense" text
      )
    )
    SELECT
      (SELECT count(*)::int
       FROM organization_input input
       JOIN organizations o ON o.slug = input.slug
       WHERE o.name = input.name
         AND o.full_name = input."fullName"
         AND o.type = input.type
         AND o.founded_year IS NOT DISTINCT FROM input."foundedYear"
         AND o.hq_country IS NOT DISTINCT FROM input."hqCountry"
         AND o.member_count IS NOT DISTINCT FROM input."memberCount"
         AND o.source_id = ${ORGANIZATION_MEMBERSHIP_SOURCE_ID}
         AND o.source_url = input."sourceUrl"
         AND o.source_license = input."sourceLicense"
         AND o.source_retrieved_at = ${retrievedAt}
         AND o.upstream_vintage = ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION}
      ) AS organizations_matched,
      (SELECT count(*)::int
       FROM membership_input input
       JOIN organizations o ON o.slug = input."orgSlug"
       JOIN jurisdictions j ON upper(j.iso3) = input."countryId"
       JOIN organization_memberships om
         ON om.org_id = o.id AND om.jurisdiction_id = j.id
       WHERE om.join_date IS NOT DISTINCT FROM input."joinDate"
         AND om.join_date_precision = input."joinDatePrecision"
         AND om.end_date IS NOT DISTINCT FROM input."endDate"
         AND om.end_date_precision = input."endDatePrecision"
         AND om.role IS NOT DISTINCT FROM input.role
         AND om.status = input.status
         AND om.status_note IS NOT DISTINCT FROM input."statusNote"
         AND om.disputed = input.disputed
         AND om.source_id = ${ORGANIZATION_MEMBERSHIP_SOURCE_ID}
         AND om.source_url = input."sourceUrl"
         AND om.source_license = input."sourceLicense"
         AND om.source_retrieved_at = ${retrievedAt}
         AND om.upstream_vintage = ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION}
      ) AS memberships_matched,
      (SELECT count(*)::int
       FROM organization_memberships om
       JOIN organizations o ON o.id = om.org_id
       WHERE o.slug = ANY(${organizationRows.map((row) => row.slug)})
         AND om.status <> 'unverified_legacy'
         AND NOT EXISTS (
           SELECT 1
           FROM membership_input input
           JOIN jurisdictions j ON upper(j.iso3) = input."countryId"
           WHERE input."orgSlug" = o.slug AND j.id = om.jurisdiction_id
         )
      ) AS unexpected_public,
      (SELECT count(*)::int
       FROM sources s
       WHERE s.id = ${ORGANIZATION_MEMBERSHIP_SOURCE_ID}
         AND s.name = 'Civica organization roster v1'
         AND s.license = ${sourceLicense}
         AND s.is_commercial_use_allowed = false
         AND s.last_sync_at = ${retrievedAt}
      ) AS source_matched
  `;
  if (
    Number(releaseState.organizations_matched) === organizationRows.length &&
    Number(releaseState.memberships_matched) === membershipRows.length &&
    Number(releaseState.unexpected_public) === 0 &&
    Number(releaseState.source_matched) === 1
  ) {
    console.log(
      "\nRelease already matches storage exactly; writes performed: 0.",
    );
    return;
  }

  const rowsWritten = 1 + organizationRows.length + membershipRows.length;
  const queries = [
    neonSql`
      INSERT INTO sources (id, name, base_url, license, is_commercial_use_allowed)
      VALUES (
        ${ORGANIZATION_MEMBERSHIP_SOURCE_ID},
        'Civica organization roster v1',
        'https://www.civicaatlas.org/methodology/source-coverage',
        ${sourceLicense},
        false
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        base_url = EXCLUDED.base_url,
        license = EXCLUDED.license,
        is_commercial_use_allowed = EXCLUDED.is_commercial_use_allowed
    `,
    neonSql`
      WITH input AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(organizationRows)}::jsonb) AS x(
          slug text, name text, "fullName" text, type text, "foundedYear" integer,
          "hqCountry" text, "memberCount" integer, extra jsonb,
          "sourceUrl" text, "sourceLicense" text
        )
      ), locked_input AS MATERIALIZED (
        SELECT
          input.*,
          pg_advisory_xact_lock(
            hashtextextended('atlas-organization:' || input.slug, 0)
          ) AS lock_acquired
        FROM input
      ), before_rows AS MATERIALIZED (
        SELECT o.*
        FROM organizations o
        JOIN locked_input input ON input.slug = o.slug
        FOR UPDATE OF o
      ), upsert_input AS MATERIALIZED (
        SELECT input.*, prior.id AS prior_id
        FROM locked_input input
        LEFT JOIN before_rows prior ON prior.slug = input.slug
      ), upserted AS (
        INSERT INTO organizations (
          slug, name, full_name, type, founded_year, hq_country, member_count,
          extra, source_id, source_url, source_license, source_retrieved_at,
          upstream_vintage, updated_at
        )
        SELECT
          slug, name, "fullName", type, "foundedYear", "hqCountry", "memberCount",
          extra, ${ORGANIZATION_MEMBERSHIP_SOURCE_ID}, "sourceUrl", "sourceLicense",
          ${retrievedAt}, ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION}, ${retrievedAt}
        FROM upsert_input
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          full_name = EXCLUDED.full_name,
          type = EXCLUDED.type,
          founded_year = EXCLUDED.founded_year,
          hq_country = EXCLUDED.hq_country,
          member_count = EXCLUDED.member_count,
          extra = COALESCE(EXCLUDED.extra, organizations.extra),
          source_id = EXCLUDED.source_id,
          source_url = EXCLUDED.source_url,
          source_license = EXCLUDED.source_license,
          source_retrieved_at = EXCLUDED.source_retrieved_at,
          upstream_vintage = EXCLUDED.upstream_vintage,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      ), change_payload AS (
        SELECT
          upserted.id,
          (
            CASE WHEN prior.name IS DISTINCT FROM upserted.name
              THEN jsonb_build_array(jsonb_build_object('field', 'name', 'before', prior.name, 'after', upserted.name))
              ELSE '[]'::jsonb END
            ||
            CASE WHEN prior.full_name IS DISTINCT FROM upserted.full_name
              THEN jsonb_build_array(jsonb_build_object('field', 'full_name', 'before', prior.full_name, 'after', upserted.full_name))
              ELSE '[]'::jsonb END
            ||
            CASE WHEN prior.type IS DISTINCT FROM upserted.type
              THEN jsonb_build_array(jsonb_build_object('field', 'type', 'before', prior.type, 'after', upserted.type))
              ELSE '[]'::jsonb END
            ||
            CASE WHEN prior.founded_year IS DISTINCT FROM upserted.founded_year
              THEN jsonb_build_array(jsonb_build_object('field', 'founded_year', 'before', prior.founded_year, 'after', upserted.founded_year))
              ELSE '[]'::jsonb END
            ||
            CASE WHEN prior.hq_country IS DISTINCT FROM upserted.hq_country
              THEN jsonb_build_array(jsonb_build_object('field', 'hq_country', 'before', prior.hq_country, 'after', upserted.hq_country))
              ELSE '[]'::jsonb END
            ||
            CASE WHEN prior.member_count IS DISTINCT FROM upserted.member_count
              THEN jsonb_build_array(jsonb_build_object('field', 'member_count', 'before', prior.member_count, 'after', upserted.member_count))
              ELSE '[]'::jsonb END
            ||
            CASE WHEN prior.wikidata_qid IS DISTINCT FROM upserted.wikidata_qid
              THEN jsonb_build_array(jsonb_build_object('field', 'wikidata_qid', 'before', prior.wikidata_qid, 'after', upserted.wikidata_qid))
              ELSE '[]'::jsonb END
            ||
            CASE WHEN prior.source_id IS DISTINCT FROM upserted.source_id
              THEN jsonb_build_array(jsonb_build_object('field', 'source_id', 'before', prior.source_id, 'after', upserted.source_id))
              ELSE '[]'::jsonb END
            ||
            CASE WHEN prior.source_url IS DISTINCT FROM upserted.source_url
              THEN jsonb_build_array(jsonb_build_object('field', 'source_url', 'before', prior.source_url, 'after', upserted.source_url))
              ELSE '[]'::jsonb END
            ||
            CASE WHEN prior.source_license IS DISTINCT FROM upserted.source_license
              THEN jsonb_build_array(jsonb_build_object('field', 'source_license', 'before', prior.source_license, 'after', upserted.source_license))
              ELSE '[]'::jsonb END
            ||
            CASE WHEN prior.upstream_vintage IS DISTINCT FROM upserted.upstream_vintage
              THEN jsonb_build_array(jsonb_build_object('field', 'upstream_vintage', 'before', prior.upstream_vintage, 'after', upserted.upstream_vintage))
              ELSE '[]'::jsonb END
          ) AS changes
        FROM upserted
        LEFT JOIN before_rows prior ON prior.slug = upserted.slug
      ), history_events AS (
        INSERT INTO atlas_entity_change_history (
          entity_type, entity_id, entity_table, operation, change_kind, changes,
          reason, methodology_version, release_id
        )
        SELECT
          'organization',
          id::text,
          'organizations',
          CASE
            WHEN EXISTS (SELECT 1 FROM before_rows WHERE before_rows.id = change_payload.id)
              THEN 'update'
            ELSE 'insert'
          END,
          'routine_refresh',
          changes,
          'Checked organization roster source refresh',
          ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION},
          ${ATLAS_RELEASE_ID}
        FROM change_payload
        WHERE jsonb_array_length(changes) > 0
        RETURNING id
      )
      SELECT
        (SELECT count(*)::int FROM upserted) AS written,
        (SELECT count(*)::int FROM history_events) AS history_written
    `,
    neonSql`
      WITH input AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(membershipRows)}::jsonb) AS x(
          "orgSlug" text, "countryId" text
        )
      ), changed AS (
        UPDATE organization_memberships om
        SET
          status = 'unverified_legacy',
          status_note = 'Legacy seed row retained for audit; excluded from public reads unless activated by a checked release.',
          updated_at = ${retrievedAt}
        FROM organizations o
        WHERE om.org_id = o.id
          AND o.slug = ANY(${organizationRows.map((row) => row.slug)})
          AND om.status <> 'unverified_legacy'
          AND NOT EXISTS (
            SELECT 1
            FROM input
            JOIN jurisdictions j ON upper(j.iso3) = input."countryId"
            WHERE input."orgSlug" = o.slug AND j.id = om.jurisdiction_id
          )
        RETURNING om.id
      ) SELECT count(*)::int AS quarantined FROM changed
    `,
    neonSql`
      WITH input AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(membershipRows)}::jsonb) AS x(
          "orgSlug" text, "countryId" text, "joinDate" date,
          "joinDatePrecision" text, "endDate" date, "endDatePrecision" text,
          role text, status text, "statusNote" text, disputed boolean,
          "sourceUrl" text, "sourceLicense" text
        )
      ), upserted AS (
        INSERT INTO organization_memberships (
          org_id, jurisdiction_id, join_date, join_date_precision, end_date,
          end_date_precision, role, status, status_note, disputed, source_id,
          source_url, source_license, source_retrieved_at, upstream_vintage,
          updated_at
        )
        SELECT
          o.id, j.id, input."joinDate", input."joinDatePrecision",
          input."endDate", input."endDatePrecision", input.role, input.status,
          input."statusNote", input.disputed, ${ORGANIZATION_MEMBERSHIP_SOURCE_ID},
          input."sourceUrl", input."sourceLicense", ${retrievedAt},
          ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION}, ${retrievedAt}
        FROM input
        JOIN organizations o ON o.slug = input."orgSlug"
        JOIN jurisdictions j ON upper(j.iso3) = input."countryId"
        ON CONFLICT (org_id, jurisdiction_id) DO UPDATE SET
          join_date = EXCLUDED.join_date,
          join_date_precision = EXCLUDED.join_date_precision,
          end_date = EXCLUDED.end_date,
          end_date_precision = EXCLUDED.end_date_precision,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          status_note = EXCLUDED.status_note,
          disputed = EXCLUDED.disputed,
          source_id = EXCLUDED.source_id,
          source_url = EXCLUDED.source_url,
          source_license = EXCLUDED.source_license,
          source_retrieved_at = EXCLUDED.source_retrieved_at,
          upstream_vintage = EXCLUDED.upstream_vintage,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      ) SELECT count(*)::int AS written FROM upserted
    `,
    markSourcesSyncedTransactionQuery(
      neonSql,
      [ORGANIZATION_MEMBERSHIP_SOURCE_ID],
      rowsWritten,
      retrievedAt,
    ),
  ];

  const results = await neonSql.transaction(queries);
  const organizationsWritten = Number(results[1]?.[0]?.written ?? 0);
  const quarantined = Number(results[2]?.[0]?.quarantined ?? 0);
  const membershipsWritten = Number(results[3]?.[0]?.written ?? 0);
  if (
    organizationsWritten !== organizationRows.length ||
    membershipsWritten !== membershipRows.length
  ) {
    throw new Error(
      `Atomic release count mismatch: orgs ${organizationsWritten}/${organizationRows.length}, memberships ${membershipsWritten}/${membershipRows.length}`,
    );
  }

  console.log(
    `\nApplied ${organizationsWritten} organizations and ${membershipsWritten} relationships atomically; ${quarantined} legacy rows were quarantined before checked rows were activated.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
