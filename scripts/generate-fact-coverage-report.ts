import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import {
  buildFactCoverageReport,
  type CoverageDisputeRow,
  type CoverageFactRow,
  type CoverageSource,
  type CoverageStatementRow,
} from "../src/lib/provenance/fact-coverage";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const [sources, facts, statements, disputes] = await Promise.all([
    sql`SELECT id, base_url AS "baseUrl", license FROM sources ORDER BY id`,
    sql`SELECT cf.id,
               cf.jurisdiction_id AS "jurisdictionId",
               j.slug AS "jurisdictionSlug",
               j.name AS "jurisdictionName",
               cf.fact_key AS "factKey",
               cf.source_id AS "sourceId",
               cf.source_url AS "sourceUrl",
               cf.retrieved_at::text AS "retrievedAt"
        FROM country_facts cf
        JOIN jurisdictions j ON j.id = cf.jurisdiction_id
        WHERE cf.status = 'active'
        ORDER BY j.slug, cf.fact_key, cf.source_id`,
    sql`SELECT id,
               subject_table AS "subjectTable",
               subject_id AS "subjectId",
               predicate,
               source_id AS "sourceId",
               source_url AS "sourceUrl",
               retrieved_at::text AS "retrievedAt"
        FROM statements
        ORDER BY subject_table, subject_id, predicate, source_id`,
    sql`SELECT jurisdiction_id AS "jurisdictionId", fact_key AS "factKey", status
        FROM data_disputes
        ORDER BY jurisdiction_id, fact_key, status`,
  ]);

  const report = buildFactCoverageReport({
    generatedAt: new Date().toISOString(),
    sources: sources as CoverageSource[],
    facts: facts as CoverageFactRow[],
    statements: statements as CoverageStatementRow[],
    disputes: disputes as CoverageDisputeRow[],
  });
  const output = resolve(
    process.cwd(),
    "src/lib/provenance/fact-coverage.generated.json",
  );
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${output}`);
  console.log(JSON.stringify(report.facts));
  console.log(JSON.stringify(report.statements));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
