import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildSchemaDataDictionary,
  canonicalDictionaryJson,
  dictionaryValidationErrors,
  type SchemaDataDictionary,
} from "../src/lib/data-dictionary/build";

const artifactPath = resolve(process.cwd(), "data/schema-data-dictionary.v1.json");
const expected = buildSchemaDataDictionary();
const errors = dictionaryValidationErrors(expected);
let checked: SchemaDataDictionary | null = null;

try {
  checked = JSON.parse(readFileSync(artifactPath, "utf8")) as SchemaDataDictionary;
} catch (error) {
  errors.push(`cannot read checked dictionary: ${error instanceof Error ? error.message : String(error)}`);
}

if (checked && canonicalDictionaryJson(checked) !== canonicalDictionaryJson(expected)) {
  errors.push("checked dictionary differs from the current schema/policy registry; run npm run generate:data-dictionary and review the diff");
}

console.log("=== DAT-009 schema data-dictionary validation ===\n");
console.log(`Schema tables: ${expected.summary.tables}`);
console.log(`Documented columns: ${expected.summary.columns}`);
console.log(`Schema fingerprint: ${expected.schemaFingerprint}`);
console.log(`Release scopes: ${expected.summary.publicAtlasTables} atlas, ${expected.summary.researchBetaTables} research-beta, ${expected.summary.supportTables} public-support, ${expected.summary.internalTables} internal, ${expected.summary.privateTables} private`);
console.log(`Legacy tables: ${expected.summary.legacyTables}`);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log("\nPASS — every Drizzle table/column has a current field-level dictionary entry.");
