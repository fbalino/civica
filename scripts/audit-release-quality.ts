import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { FROZEN_SOURCES } from "../src/lib/data/sources";
import {
  evaluateReleaseQuality,
  formatQualityIssue,
  type IdentifierRow,
  type QualityFact,
  type QualityJurisdiction,
  type QualitySource,
  type QualityStatement,
  type QualityVintage,
  type ReleaseQualitySnapshot,
} from "../src/lib/data-quality/release-quality";
import { RELEASE_QUALITY_POLICY } from "../src/lib/data-quality/release-quality-policy";

const SUBJECT_TABLES = [
  "constitutions",
  "elections",
  "jurisdictions",
  "legislature_parties",
  "terms",
] as const;

async function collectSnapshot(): Promise<ReleaseQualitySnapshot> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const [
    jurisdictionRows,
    factRows,
    vintageRows,
    statementRows,
    sourceRows,
    organizationRows,
    electionRows,
    constitutionRows,
    subjectRows,
    rowCountRows,
  ] = await Promise.all([
    sql`SELECT j.id,
               j.slug,
               j.name,
               j.type AS status,
               j.status_source_ids AS "statusSourceIds",
               j.status_reviewed_at::text AS "statusReviewedAt",
               count(cf.id) FILTER (WHERE cf.status = 'active')::int AS "activeFactCount",
               j.iso2,
               j.iso3,
               j.wikidata_qid AS "wikidataQid"
        FROM jurisdictions j
        LEFT JOIN country_facts cf ON cf.jurisdiction_id = j.id
        GROUP BY j.id
        ORDER BY j.slug`,
    sql`SELECT id,
               jurisdiction_id AS "jurisdictionId",
               fact_key AS "factKey",
               fact_group AS "factGroup",
               category,
               source_id AS "sourceId",
               fact_value AS "factValue",
               fact_value_numeric AS "factValueNumeric",
               fact_unit AS "factUnit",
               fact_year AS "factYear",
               data_vintage_year AS "dataVintageYear",
               value_json AS "valueJson",
               value_type AS "valueType"
        FROM country_facts
        WHERE status = 'active'
        ORDER BY jurisdiction_id, fact_key, source_id`,
    sql`SELECT id,
               jurisdiction_id AS "jurisdictionId",
               fact_key AS "factKey",
               vintage_label AS "vintageLabel",
               canonical_fact_id AS "canonicalFactId",
               EXISTS (SELECT 1 FROM country_facts cf WHERE cf.id = country_fact_vintages.canonical_fact_id) AS "canonicalFactExists",
               source_id AS "sourceId",
               methodology_version AS "methodologyVersion",
               derivation_version_key AS "derivationVersionKey"
        FROM country_fact_vintages
        ORDER BY jurisdiction_id, fact_key, vintage_label`,
    sql`SELECT id,
               subject_table AS "subjectTable",
               subject_id AS "subjectId",
               source_id AS "sourceId"
        FROM statements
        ORDER BY subject_table, subject_id, id`,
    sql`SELECT s.id,
               s.name,
               s.license,
               s.last_sync_at::text AS "lastSyncAt",
               (count(DISTINCT cf.id) + count(DISTINCT st.id))::int AS "activeReferenceCount"
        FROM sources s
        LEFT JOIN country_facts cf ON cf.source_id = s.id AND cf.status = 'active'
        LEFT JOIN statements st ON st.source_id = s.id
        GROUP BY s.id
        ORDER BY s.id`,
    sql`SELECT id, slug FROM organizations ORDER BY id`,
    sql`SELECT id, wikidata_qid AS "wikidataQid" FROM elections ORDER BY id`,
    sql`SELECT id, constitute_project_id AS "constituteProjectId" FROM constitutions ORDER BY id`,
    sql`SELECT 'constitutions' AS table_name, id FROM constitutions
        UNION ALL SELECT 'elections', id FROM elections
        UNION ALL SELECT 'jurisdictions', id FROM jurisdictions
        UNION ALL SELECT 'legislature_parties', id FROM legislature_parties
        UNION ALL SELECT 'terms', id FROM terms
        ORDER BY table_name, id`,
    sql`SELECT 'jurisdictions' AS table_name, count(*)::int AS count FROM jurisdictions
        UNION ALL SELECT 'sources', count(*)::int FROM sources
        UNION ALL SELECT 'country_facts', count(*)::int FROM country_facts
        UNION ALL SELECT 'country_fact_vintages', count(*)::int FROM country_fact_vintages
        UNION ALL SELECT 'statements', count(*)::int FROM statements
        UNION ALL SELECT 'elections', count(*)::int FROM elections
        UNION ALL SELECT 'constitutions', count(*)::int FROM constitutions
        UNION ALL SELECT 'legislature_parties', count(*)::int FROM legislature_parties
        UNION ALL SELECT 'terms', count(*)::int FROM terms
        ORDER BY table_name`,
  ]);

  type JurisdictionDbRow = QualityJurisdiction & {
    iso2: string | null;
    iso3: string | null;
    wikidataQid: string | null;
  };
  const jurisdictions = jurisdictionRows as JurisdictionDbRow[];
  const identifiers: IdentifierRow[] = [];
  for (const row of jurisdictions) {
    identifiers.push(
      { namespace: "jurisdiction.slug", entityId: row.id, value: row.slug, required: true },
      { namespace: "jurisdiction.iso2", entityId: row.id, value: row.iso2 },
      { namespace: "jurisdiction.iso3", entityId: row.id, value: row.iso3 },
      { namespace: "jurisdiction.wikidata_qid", entityId: row.id, value: row.wikidataQid },
    );
  }
  for (const row of sourceRows as Array<{ id: string }>) {
    identifiers.push({ namespace: "source.id", entityId: row.id, value: row.id, required: true });
  }
  for (const row of organizationRows as Array<{ id: string; slug: string | null }>) {
    identifiers.push({ namespace: "organization.slug", entityId: row.id, value: row.slug, required: true });
  }
  for (const row of electionRows as Array<{ id: string; wikidataQid: string | null }>) {
    identifiers.push({ namespace: "election.wikidata_qid", entityId: row.id, value: row.wikidataQid });
  }
  for (const row of constitutionRows as Array<{ id: string; constituteProjectId: string | null }>) {
    identifiers.push({ namespace: "constitution.constitute_project_id", entityId: row.id, value: row.constituteProjectId });
  }

  const subjectIds = Object.fromEntries(SUBJECT_TABLES.map((table) => [table, [] as string[]]));
  for (const row of subjectRows as Array<{ table_name: string; id: string }>) {
    subjectIds[row.table_name]?.push(row.id);
  }
  const rowCounts = Object.fromEntries(
    (rowCountRows as Array<{ table_name: string; count: number }>).map((row) => [row.table_name, row.count]),
  );

  return {
    generatedAt: new Date().toISOString(),
    identifiers,
    jurisdictions,
    facts: factRows as QualityFact[],
    vintages: vintageRows as QualityVintage[],
    statements: statementRows as QualityStatement[],
    sources: (sourceRows as Omit<QualitySource, "frozen">[]).map((source) => ({
      ...source,
      frozen: FROZEN_SOURCES.has(source.id),
    })),
    subjectIds,
    rowCounts,
  };
}

async function main() {
  const report = evaluateReleaseQuality(await collectSnapshot(), RELEASE_QUALITY_POLICY);
  if (process.argv.includes("--write")) {
    const output = resolve(process.cwd(), "data/release-quality-report.v1.json");
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Wrote ${output}`);
  }
  console.log(`Release data quality: ${report.status.toUpperCase()}`);
  for (const check of report.checks) {
    console.log(`${check.status === "pass" ? "PASS" : "FAIL"} ${check.category}: ${check.issueCount} issue(s)`);
  }
  for (const issue of report.issues) console.error(formatQualityIssue(issue));
  if (report.status === "fail" && !process.argv.includes("--allow-fail")) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
