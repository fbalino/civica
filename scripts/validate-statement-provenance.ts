import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const migrationPath = "drizzle/authoritative/0001_aspiring_bloodaxe.sql";
const migration = readFileSync(migrationPath, "utf8");
const producerPaths = [
  "src/lib/elections/writer.ts",
  "src/lib/factbook/atlas-seed-writer.ts",
  "src/lib/factbook/cia-cabinets-sync.ts",
  "src/lib/factbook/officeholders-sync.ts",
  "src/lib/legislatures/composition-writer.ts",
].sort();
const producerSources = producerPaths.map((path) => readFileSync(path, "utf8"));
const errors: string[] = [];

for (const required of [
  "idx_statements_subject_predicate_source",
  "statements_subject_table_closed",
  "civica_validate_statement_subject",
  "dat_028_validate_statement_subject",
  "SET subject_table = 'government_bodies'",
  "WHERE t.person_id = s.subject_id",
  "row_number() OVER",
]) if (!migration.includes(required)) errors.push(`migration missing ${required}`);

if (producerSources.some((source) => /subjectTable:\s*["']legislature_parties["']/.test(source))) {
  errors.push("a producer still declares a body-level statement as legislature_parties");
}
const officeholderSource = readFileSync("src/lib/factbook/officeholders-sync.ts", "utf8");
const cabinetSource = readFileSync("src/lib/factbook/cia-cabinets-sync.ts", "utf8");
if (!officeholderSource.includes("subjectId: termId") || !cabinetSource.includes("subjectId: termId")) {
  errors.push("term statement producers do not persist the returned term id");
}
function findTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

const discoveredProducers = ["src", "scripts"]
  .flatMap(findTypeScriptFiles)
  .filter((path) => !path.includes("/__tests__/") && !path.endsWith(".test.ts"))
  .filter((path) =>
    /insert\(statements\)|db\.insert\(statements\)|INSERT\s+INTO\s+statements/i.test(
      readFileSync(path, "utf8"),
    ),
  )
  .sort();
if (JSON.stringify(discoveredProducers) !== JSON.stringify(producerPaths)) {
  errors.push(`statement producer inventory drift: ${JSON.stringify(discoveredProducers)}`);
}
for (let index = 0; index < producerSources.length; index += 1) {
  const source = producerSources[index];
  const rawSqlProducer = /INSERT\s+INTO\s+statements/i.test(source);
  const hasSourceIdentity = rawSqlProducer
    ? /source_id\s*=\s*\$\{|ON CONFLICT\s*\([^)]*source_id/i.test(source)
    : source.includes("statements.sourceId");
  if (!hasSourceIdentity)
    errors.push(
      `${producerPaths[index]} does not include source_id in its statement identity lookup`,
    );
  const hasRerunUpdate = rawSqlProducer
    ? /ON CONFLICT\s*\([^)]*source_id[^)]*\)\s*DO UPDATE SET/i.test(source)
    : (/select\(|\.select\(/.test(source) &&
      /update\(statements\)|\.update\(statements\)/.test(source));
  if (!hasRerunUpdate) {
    errors.push(`${producerPaths[index]} lacks an update-on-rerun statement path`);
  }
}

async function main() {
if (process.argv.includes("--live")) {
  if (!process.env.DATABASE_URL) errors.push("DATABASE_URL is required for --live");
  else {
    const sql = neon(process.env.DATABASE_URL);
    const [audit] = await sql.query(`SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE NOT CASE s.subject_table
        WHEN 'constitutions' THEN EXISTS (SELECT 1 FROM constitutions x WHERE x.id=s.subject_id)
        WHEN 'elections' THEN EXISTS (SELECT 1 FROM elections x WHERE x.id=s.subject_id)
        WHEN 'government_bodies' THEN EXISTS (SELECT 1 FROM government_bodies x WHERE x.id=s.subject_id)
        WHEN 'jurisdictions' THEN EXISTS (SELECT 1 FROM jurisdictions x WHERE x.id=s.subject_id)
        WHEN 'terms' THEN EXISTS (SELECT 1 FROM terms x WHERE x.id=s.subject_id)
        ELSE false END)::int AS orphans,
      (SELECT count(*)::int FROM (
        SELECT 1 FROM statements GROUP BY subject_table,subject_id,predicate,source_id HAVING count(*)>1
      ) duplicates) AS duplicate_groups
      FROM statements s`, []) as unknown as Array<{ total: number; orphans: number; duplicate_groups: number }>;
    const [shape] = await sql.query(`SELECT
      to_regclass('public.idx_statements_subject_predicate_source') IS NOT NULL AS unique_index,
      EXISTS (SELECT 1 FROM pg_constraint WHERE conname='statements_subject_table_closed') AS subject_check,
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='dat_028_validate_statement_subject' AND NOT tgisinternal) AS subject_trigger`, []) as unknown as Array<{ unique_index: boolean; subject_check: boolean; subject_trigger: boolean }>;
    if (audit.orphans !== 0) errors.push(`live statement orphans: ${audit.orphans}`);
    if (audit.duplicate_groups !== 0) errors.push(`live duplicate identity groups: ${audit.duplicate_groups}`);
    if (!shape.unique_index || !shape.subject_check || !shape.subject_trigger) errors.push("live statement enforcement is incomplete");
    console.log(`Live statements: ${audit.total}; orphans: ${audit.orphans}; duplicate groups: ${audit.duplicate_groups}; enforcement: ${shape.unique_index && shape.subject_check && shape.subject_trigger ? "closed" : "incomplete"}`);
  }
}

console.log("=== DAT-028 statement provenance ===\n");
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log("PASS — producers, repair migration, identity uniqueness, and polymorphic subject validation are closed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
