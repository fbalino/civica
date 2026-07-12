import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { MIGRATION_ARTIFACTS } from "../src/lib/db/migration-registry";
import { validateMigrationRegistry } from "../src/lib/db/migration-validation";

const root = process.cwd();
const sqlFiles = readdirSync(resolve(root, "drizzle/migrations")).filter((name) => name.endsWith(".sql")).map((name) => `drizzle/migrations/${name}`).sort();
const registeredAuthoritativeSql = MIGRATION_ARTIFACTS
  .map(({ path }) => path)
  .filter((path) => path.startsWith("drizzle/authoritative/") && path.endsWith(".sql"));
const dataNames = ["backfill-cia-vintage", "backfill-election-results", "backfill-growth-methodology", "backfill-methodology-version", "backfill-territory-iso2", "backfill-upstream-vintage-labels", "bridge-cia-legacy-to-canonical", "cleanup-bad-offices", "create-rate-limits-table", "reseed-bug3-corrupted", "restore-overdemoted-disputes"];
const dataScripts = dataNames.map((name) => `scripts/${name}.ts`);
const journal = JSON.parse(readFileSync(resolve(root, "drizzle/migrations/meta/_journal.json"), "utf8")) as { entries: Array<{ tag: string }> };
const authoritativeJournal = JSON.parse(readFileSync(resolve(root, "drizzle/authoritative/meta/_journal.json"), "utf8")) as { entries: Array<{ tag: string }> };
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
const registeredAuthoritativeTags = new Set(
  registeredAuthoritativeSql.map((path) => path.split("/").at(-1)!.replace(/\.sql$/, "")),
);
const errors = validateMigrationRegistry(
  MIGRATION_ARTIFACTS,
  [...sqlFiles, ...registeredAuthoritativeSql],
  dataScripts,
  [
    ...journal.entries.map((entry) => entry.tag),
    ...authoritativeJournal.entries
      .map((entry) => entry.tag)
      .filter((tag) => registeredAuthoritativeTags.has(tag)),
  ],
  pkg.scripts,
);
for (const entry of MIGRATION_ARTIFACTS) {
  if (!existsSync(resolve(root, entry.path))) errors.push(`${entry.id} missing artifact ${entry.path}`);
  if (!existsSync(resolve(root, entry.releaseNote))) errors.push(`${entry.id} missing release note ${entry.releaseNote}`);
  else if (!readFileSync(resolve(root, entry.releaseNote), "utf8").includes(entry.id)) errors.push(`${entry.id} release note does not name the migration`);
}
console.log("=== DAT-013 migration discipline ===\n");
console.log(`Forward artifacts: ${MIGRATION_ARTIFACTS.length} (${sqlFiles.length + registeredAuthoritativeSql.length} SQL, ${dataScripts.length} operational data changes)`);
console.log(`Journaled legacy artifacts: ${journal.entries.length}`);
console.log(`Explicitly disclosed unjournaled/colliding artifacts: ${MIGRATION_ARTIFACTS.filter((entry) => entry.historyStatus.startsWith("legacy_")).length}`);
if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
console.log("\nPASS — migration artifacts, history status, planning, compensation, invariants, release notes, and db:push policy are closed.");
