import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { config } from "dotenv";
import { ATLAS_EXPORT_RELEASE_ID, ATLAS_EXPORT_SCHEMA_VERSION, atlasExportSha256, buildAtlasExport, loadAtlasExportInput, serializeAtlasExport } from "../src/lib/exports/atlas-release";
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
if (manifest.sha256 !== atlasExportSha256(serialized)) fail("content hash mismatch");
if (manifest.byteLength !== Buffer.byteLength(serialized)) fail("byte length mismatch");
if (manifest.compressedSha256 !== createHash("sha256").update(compressed).digest("hex")) fail("compressed hash mismatch");
if (manifest.compressedByteLength !== compressed.byteLength) fail("compressed byte length mismatch");
if (!apiDocs.includes(manifest.sha256) || !apiDocs.includes(manifest.publicDownload)) fail("API docs do not match the checked release");
if (JSON.stringify(manifest.counts) !== JSON.stringify(release.counts)) fail("count mismatch");
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
}
const decision = evaluatePublicExport("atlas-reference-export-v1", [...sourceIds]);
if (!decision.allowed) fail(decision.reason);
if (serializeAtlasExport(release) !== serialized) fail("non-canonical serialization");
async function main() {
  if (process.argv.includes("--live")) {
    const rebuilt = serializeAtlasExport(buildAtlasExport(await loadAtlasExportInput()));
    if (rebuilt !== serialized) fail("live rebuild differs from frozen release");
  }
  console.log("=== DAT-017 atlas export ===\n");
  console.log(`Release: ${release.releaseId}`);
  console.log(`Rows: ${release.counts.jurisdictions} jurisdictions, ${release.counts.facts} facts, ${release.counts.sources} sources`);
  console.log(`SHA-256: ${manifest.sha256}`);
  console.log("\nPASS — package, rights joins, codebook, ordering, counts, and hashes agree.");
}

main().catch((error) => { console.error(error); process.exit(1); });
