import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { FACT_KEYS } from "../src/lib/factbook/reconcile/fact-keys";
import {
  buildReconciliationAudit,
  type AuditFactRow,
} from "../src/lib/factbook/reconcile/reconciliation-audit";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const facts = await sql`
    SELECT cf.jurisdiction_id AS "jurisdictionId",
           j.iso3 AS "jurisdictionIso3",
           cf.fact_key AS "factKey",
           cf.source_id AS "sourceId",
           cf.value_type AS "valueType"
    FROM country_facts cf
    JOIN jurisdictions j ON j.id = cf.jurisdiction_id
    WHERE cf.status = 'active'
    ORDER BY cf.fact_key, cf.source_id, j.iso3
  `;
  const report = buildReconciliationAudit({
    generatedAt: new Date().toISOString(),
    factDefinitions: Object.values(FACT_KEYS),
    facts: facts as AuditFactRow[],
  });
  const output = resolve(
    process.cwd(),
    "src/lib/factbook/reconcile/reconciliation-audit.generated.json",
  );
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${output}`);
  console.log(JSON.stringify(report.registry));
  console.log(
    JSON.stringify({
      activeSourceFactPairs: report.lineage.activeSourceFactPairs,
      unverifiedSourceFactPairs: report.lineage.unverifiedSourceFactPairs,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
