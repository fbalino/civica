import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildSchemaDataDictionary,
  canonicalDictionaryJson,
  dictionaryValidationErrors,
} from "../src/lib/data-dictionary/build";

const output = resolve(process.cwd(), "data/schema-data-dictionary.v1.json");
const dictionary = buildSchemaDataDictionary();
const errors = dictionaryValidationErrors(dictionary);
if (errors.length) throw new Error(errors.join("\n"));
writeFileSync(output, canonicalDictionaryJson(dictionary));
console.log(`Wrote ${output}`);
console.log(`Tables: ${dictionary.summary.tables}; columns: ${dictionary.summary.columns}`);
console.log(`Schema fingerprint: ${dictionary.schemaFingerprint}`);
