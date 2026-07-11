import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { config } from "dotenv";
import { ATLAS_EXPORT_RELEASE_ID, ATLAS_EXPORT_SCHEMA_VERSION, ATLAS_EXPORT_VINTAGE_LABEL, atlasExportSha256, buildAtlasExport, buildAtlasReleaseBom, loadAtlasExportInput, serializeAtlasExport } from "../src/lib/exports/atlas-release";
import { evaluatePublicExport } from "../src/lib/rights/manifest";

config({ path: ".env.local", override: true });

type Release = ReturnType<typeof buildAtlasExport>;
const manifest = JSON.parse(readFileSync(`data/releases/${ATLAS_EXPORT_RELEASE_ID}/manifest.v1.json`, "utf8"));
const compressed = readFileSync(`data/releases/${ATLAS_EXPORT_RELEASE_ID}/atlas-export.v1.json.gz`);
const serialized = gunzipSync(compressed).toString("utf8");
const release = JSON.parse(serialized) as Release;
const apiDocs = readFileSync("src/app/api-docs/page.tsx", "utf8");
const fail = (message: string): never => { throw new Error(`DAT-017 atlas export validation failed: ${message}`); };

if (release.schemaVersion !== ATLAS_EXPORT_SCHEMA_VERSION) fail("schema version drift");
if (release.releaseId !== ATLAS_EXPORT_RELEASE_ID) fail("release id drift");
if (release.vintageLabel !== ATLAS_EXPORT_VINTAGE_LABEL || !release.cutoffAt) fail("frozen vintage identity or cutoff drift");
const file = manifest.files?.[0];
if (manifest.schemaVersion !== "civica-release-bom/v1") fail("BOM schema drift");
if (file?.semanticSha256 !== atlasExportSha256(serialized)) fail("content hash mismatch");
if (file?.uncompressedByteLength !== Buffer.byteLength(serialized)) fail("byte length mismatch");
if (file?.fileSha256 !== createHash("sha256").update(compressed).digest("hex")) fail("compressed hash mismatch");
if (file?.fileByteLength !== compressed.byteLength) fail("compressed byte length mismatch");
if (!apiDocs.includes(file.semanticSha256) || !apiDocs.includes(manifest.publicDownload) || !apiDocs.includes("civica-atlas-2026-07-11.manifest.json")) fail("API docs do not match the checked release");
if (JSON.stringify(manifest.rowCounts) !== JSON.stringify(release.counts)) fail("count mismatch");
if (!/^[0-9a-f]{40}$/.test(manifest.exportSourceCommit)) fail("source commit is missing");
for (const key of ["node", "next", "drizzleOrm", "typescript", "tsx"]) if (!manifest.tools?.[key]) fail(`tool version missing: ${key}`);
if (!Array.isArray(manifest.sourceInputs) || manifest.sourceInputs.length !== release.counts.sources) fail("source-input BOM incomplete");
if (release.tables.jurisdictions.length !== release.counts.jurisdictions || release.tables.facts.length !== release.counts.facts || release.tables.sources.length !== release.counts.sources) fail("table counts drift");
const jurisdictionIds = new Set(release.tables.jurisdictions.map((row) => String(row.id)));
const sourceIds = new Set(release.tables.sources.map((row) => row.sourceId));
for (const [tableName, tableRows] of Object.entries(release.tables)) {
  const documented = new Set(Object.keys(release.codebook.columns[tableName as keyof typeof release.codebook.columns]));
  for (const key of Object.keys(tableRows[0] ?? {})) if (!documented.has(key)) fail(`${tableName}.${key} is missing from the codebook`);
}
for (const fact of release.tables.facts) {
  if (!jurisdictionIds.has(String(fact.jurisdiction_id))) fail(`orphan fact ${fact.id}`);
  if (!sourceIds.has(String(fact.source_id))) fail(`fact ${fact.id} lacks rights row`);
  for (const prohibited of ["score", "rank", "pulse", "classifier_runs"]) if (prohibited in fact) fail(`fact ${fact.id} leaks ${prohibited}`);
  if (fact.vintage_label !== release.vintageLabel || fact.methodology_version !== "v0.2-beta" || !/^[a-f0-9]{64}$/.test(String(fact.content_hash))) fail(`fact ${fact.id} is outside the frozen vintage/hash/method contract`);
}
const decision = evaluatePublicExport("atlas-reference-export-v1", [...sourceIds]);
if (!decision.allowed) fail(decision.reason);
if (serializeAtlasExport(release) !== serialized) fail("non-canonical serialization");
async function main() {
  if (process.argv.includes("--live")) {
    const rebuiltRelease = buildAtlasExport(await loadAtlasExportInput());
    const rebuilt = serializeAtlasExport(rebuiltRelease);
    if (rebuilt !== serialized) fail("live rebuild differs from frozen release");
    const rebuiltBom = buildAtlasReleaseBom({ release: rebuiltRelease, serialized: rebuilt, compressed, codeCommit: manifest.exportSourceCommit, tools: manifest.tools });
    if (`${JSON.stringify(rebuiltBom, null, 2)}\n` !== `${JSON.stringify(manifest, null, 2)}\n`) fail("live BOM rebuild differs from checked manifest");
  }
  console.log("=== DAT-017 atlas export ===\n");
  console.log(`Release: ${release.releaseId}`);
  console.log(`Rows: ${release.counts.jurisdictions} jurisdictions, ${release.counts.facts} facts, ${release.counts.sources} sources`);
console.log(`SHA-256: ${file.semanticSha256}`);
  console.log("\nPASS — package, rights joins, codebook, ordering, counts, and hashes agree.");
}

main().catch((error) => { console.error(error); process.exit(1); });
