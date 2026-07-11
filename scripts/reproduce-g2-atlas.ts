import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildAtlasExport, serializeAtlasExport } from "../src/lib/exports/atlas-release";

for (const key of ["DATABASE_URL", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
  if (process.env[key]) throw new Error(`${key} must be unset for offline G2 reproduction`);
}
if (process.argv.includes("--strict-clean")) {
  for (const path of [".env.local", ".next", ".turbo", ".cache"]) {
    if (existsSync(path)) throw new Error(`strict G2 reproduction refuses ${path}`);
  }
}
const dir = "data/releases/atlas-2026-07-11/g2-rc1";
const bom = JSON.parse(readFileSync(`${dir}/release-bom.v1.json`, "utf8"));
const compressed = readFileSync(`${dir}/atlas-export.v1.json.gz`);
const sourceRelease = JSON.parse(gunzipSync(compressed).toString("utf8"));
const rebuilt = buildAtlasExport({
  jurisdictions: sourceRelease.tables.jurisdictions,
  facts: sourceRelease.tables.facts,
});
const serialized = serializeAtlasExport(rebuilt);
const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const result = {
  pass: sha(serialized) === bom.files[0].semanticSha256 && sha(compressed) === bom.files[0].fileSha256,
  releaseId: rebuilt.releaseId,
  semanticSha256: sha(serialized),
  fileSha256: sha(compressed),
  rowCounts: rebuilt.counts,
  credentialsUsed: [],
  networkRequests: 0,
  boundary: "normalized release reconstruction; not upstream publisher-byte replay",
};
if (!result.pass) throw new Error("G2 Atlas reproduction differs from release BOM");
console.log(JSON.stringify(result, null, 2));
