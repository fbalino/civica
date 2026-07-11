import { mkdirSync, writeFileSync } from "node:fs";
import { INDEX_DISPOSITION, INDEX_DISPOSITION_SHA256, indexDispositionErrors } from "../src/lib/ci/index-disposition";

const errors = indexDispositionErrors();
if (errors.length) throw new Error(errors.join("\n"));
const directory = "data/releases/index-disposition-2026-07-v1";
mkdirSync(directory, { recursive: true });
writeFileSync(`${directory}/resolution.v1.json`, `${JSON.stringify({ ...INDEX_DISPOSITION, resolutionSha256: INDEX_DISPOSITION_SHA256 }, null, 2)}\n`);
console.log(`Wrote ${INDEX_DISPOSITION.releaseId} (${INDEX_DISPOSITION.selectedDisposition}).`);
