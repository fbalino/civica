import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { MINIMUM_CI_STAGE_COVERAGE, REQUIRED_CI_ADAPTERS } from "../src/lib/ci/atomic-ingestion";

config({ path: ".env.local", quiet: true });

async function main() {
  const errors: string[] = [];
  const orchestrator = readFileSync("scripts/ingest-ci-all.ts", "utf8");
  const ingest = readFileSync("src/lib/ci/ingest.ts", "utf8");
  const migration = readFileSync("drizzle/authoritative/0003_mixed_mockingbird.sql", "utf8") + readFileSync("drizzle/authoritative/0004_naive_dust.sql", "utf8");
  for (const token of ["sql.transaction", "validateStagedCiRelease", "canonicalStageChecksum", "markSourcesSyncedTransactionQuery", "process.exit(1)", "status='failed'", "status='completed'"]) if (!orchestrator.includes(token)) errors.push(`orchestrator missing ${token}`);
  if (!ingest.includes("CI_INGEST_STAGE_FILE") || !ingest.includes('flag: "wx"')) errors.push("adapters do not use exclusive stage files");
  for (const adapter of REQUIRED_CI_ADAPTERS) if (!orchestrator.includes(adapter)) errors.push(`required adapter absent: ${adapter}`);
  if (Object.keys(MINIMUM_CI_STAGE_COVERAGE).length !== REQUIRED_CI_ADAPTERS.length) errors.push("coverage policy does not close the adapter inventory");
  for (const token of ["ci_ingestion_runs_status_closed", "ci_ingestion_runs_terminal_shape", "dat_016_retain_mutation"]) if (!migration.includes(token)) errors.push(`run-ledger migration missing ${token}`);

  if (process.argv.includes("--live")) {
    if (!process.env.DATABASE_URL) errors.push("DATABASE_URL is required for --live");
    else {
      const sql = neon(process.env.DATABASE_URL);
      const [failed, completed, scoreGroups, constraints, trigger] = await Promise.all([
        sql`SELECT r.*, (SELECT count(*)::int FROM research_evidence_history h WHERE h.entity_table='ci_dimension_scores' AND h.recorded_at BETWEEN r.started_at AND r.completed_at) AS score_mutations FROM ci_ingestion_runs r WHERE status='failed' ORDER BY started_at DESC LIMIT 1`,
        sql`SELECT * FROM ci_ingestion_runs WHERE status='completed' ORDER BY started_at DESC LIMIT 1`,
        sql`SELECT dimension,source_id,count(*)::int AS rows FROM ci_dimension_scores WHERE quarter='2024-Q4' AND methodology_version='beta' AND dimension=ANY(${["democratic_quality","rule_of_law","freedom_rights","corruption_control"]}) GROUP BY dimension,source_id ORDER BY dimension,source_id`,
        sql`SELECT count(*)::int AS count FROM pg_constraint WHERE conname IN ('ci_ingestion_runs_status_closed','ci_ingestion_runs_terminal_shape')`,
        sql`SELECT count(*)::int AS count FROM pg_trigger WHERE tgname='dat_016_retain_mutation' AND tgrelid='ci_ingestion_runs'::regclass AND NOT tgisinternal`,
      ]);
      const failedRun = failed[0];
      const completedRun = completed[0];
      if (!failedRun || Number(failedRun.score_mutations) !== 0) errors.push("failed fixture is absent or mutated visible scores");
      if (!completedRun || !/^[a-f0-9]{64}$/.test(String(completedRun.staged_checksum)) || new Date(completedRun.completed_at) < new Date(completedRun.started_at)) errors.push("completed run lacks checksum or monotonic terminal time");
      const resultRows = Array.isArray(completedRun?.adapter_results) ? completedRun.adapter_results : [];
      if (resultRows.length !== REQUIRED_CI_ADAPTERS.length || resultRows.reduce((sum: number, row: { rows?: number }) => sum + Number(row.rows ?? 0), 0) !== 745) errors.push("completed manifest does not record all 745 rows");
      const expected = [["corruption_control","transparency_intl",175],["democratic_quality","vdem",170],["democratic_quality","worldbank_wgi",20],["freedom_rights","freedom_house",190],["rule_of_law","worldbank_wgi",190]];
      const actual = scoreGroups.map((row) => [row.dimension,row.source_id,Number(row.rows)]);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push("visible score groups differ from the completed manifest");
      if (Number(constraints[0]?.count) !== 2 || Number(trigger[0]?.count) !== 1) errors.push("live run-ledger enforcement is incomplete");
      console.log(`Live: failed score mutations ${failedRun?.score_mutations}; completed rows 745; score groups ${scoreGroups.length}; ledger enforcement 3/3`);
    }
  }

  console.log("=== DAT-030 atomic Index ingestion ===\n");
  if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
  console.log("PASS — adapters stage, the source basket validates, failures preserve the prior release, and publication is atomic.");
}
main().catch((error) => { console.error(error); process.exit(1); });
