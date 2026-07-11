import { mkdirSync, writeFileSync } from "node:fs";
import { INDEX_MISUSE_AUDIT, INDEX_MISUSE_AUDIT_SHA256, misuseAuditErrors } from "../src/lib/ci/misuse-audit";

const errors = misuseAuditErrors();
if (errors.length) throw new Error(errors.join("; "));
const result = { ...INDEX_MISUSE_AUDIT, resultSha256: INDEX_MISUSE_AUDIT_SHA256 };
const directory = "data/releases/index-misuse-audit-v1";
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/result.v1.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${INDEX_MISUSE_AUDIT_SHA256}`);
