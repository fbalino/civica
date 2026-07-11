import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import YAML from "yaml";
import { buildAtlasExport, serializeAtlasExport } from "../src/lib/exports/atlas-release";
import { buildRightsManifest } from "../src/lib/rights/manifest";

const dir = resolve("data/releases/atlas-2026-07-11/g2-rc1");
const archive = resolve("data/releases/atlas-2026-07-11-g2-rc1.zip");
const archiveManifest = JSON.parse(readFileSync(resolve("data/releases/atlas-2026-07-11-g2-rc1.archive.json"), "utf8"));
const expectedFiles = [
  "atlas-export.v1.json.gz", "bundle-manifest.v1.json", "CHANGELOG.md",
  "CITATION.cff", "clean-room-evidence.v1.json", "codebook.v1.json",
  "coverage-report.v1.json", "environment.v1.json", "G2-CHECKLIST.json",
  "KNOWN-LIMITATIONS.md", "release-bom.v1.json", "REPRODUCE.md",
  "rights-manifest.v1.json", "SHA256SUMS", "source-input-manifest.v1.json",
  "versioned-code.v1.json",
].sort();
const actualFiles = readdirSync(dir).sort();
const problems: string[] = [];
const fail = (message: string) => problems.push(message);
const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) fail("bundle file inventory drift");

const sums = new Map(
  readFileSync(join(dir, "SHA256SUMS"), "utf8").trim().split("\n").map((line) => {
    const [hash, path] = line.split(/\s{2}/);
    return [path, hash];
  }),
);
for (const file of expectedFiles.filter((file) => file !== "SHA256SUMS")) {
  if (sums.get(file) !== sha(readFileSync(join(dir, file)))) fail(`checksum mismatch: ${file}`);
}
if (sums.size !== expectedFiles.length - 1) fail("SHA256SUMS inventory drift");

const bom = JSON.parse(readFileSync(join(dir, "release-bom.v1.json"), "utf8"));
const versionedCode = JSON.parse(readFileSync(join(dir, "versioned-code.v1.json"), "utf8"));
if (versionedCode.commit !== bom.exportSourceCommit || versionedCode.sourceSha256 !== sha(versionedCode.source) || versionedCode.path !== "src/lib/exports/atlas-release.ts" || !versionedCode.source.includes("buildAtlasExport")) fail("self-contained versioned code evidence drift");
const compressed = readFileSync(join(dir, "atlas-export.v1.json.gz"));
const original = JSON.parse(gunzipSync(compressed).toString("utf8"));
const rebuilt = buildAtlasExport({ jurisdictions: original.tables.jurisdictions, facts: original.tables.facts });
if (sha(serializeAtlasExport(rebuilt)) !== bom.files[0].semanticSha256) fail("offline normalized rebuild differs from semantic checksum");
if (sha(compressed) !== bom.files[0].fileSha256) fail("frozen archive differs from BOM");
if (JSON.stringify(rebuilt.counts) !== JSON.stringify(bom.rowCounts)) fail("rebuilt row counts differ from BOM");

const codebook = JSON.parse(readFileSync(join(dir, "codebook.v1.json"), "utf8"));
if (JSON.stringify(codebook.codebook) !== JSON.stringify(original.codebook)) fail("standalone codebook differs from export");
const rights = JSON.parse(readFileSync(join(dir, "rights-manifest.v1.json"), "utf8"));
if (JSON.stringify(rights) !== JSON.stringify(buildRightsManifest())) fail("rights manifest drift");
const inputs = JSON.parse(readFileSync(join(dir, "source-input-manifest.v1.json"), "utf8"));
if (inputs.captureLevel !== "immutable-civica-vintage-rows" || inputs.upstreamPublisherBytesRetained !== false) fail("input reconstruction boundary drift");
if (inputs.inputs.length !== bom.sourceInputs.length) fail("source-input inventory drift");
for (const source of bom.sourceInputs) {
  const input = inputs.inputs.find((row: { sourceId: string }) => row.sourceId === source.sourceId);
  if (!input || input.semanticSha256 !== source.semanticSha256 || input.rowCount !== source.rowCount || input.rights?.publicExport !== "allowed") fail(`source input mismatch: ${source.sourceId}`);
}
const coverage = JSON.parse(readFileSync(join(dir, "coverage-report.v1.json"), "utf8"));
if (coverage.rows !== bom.rowCounts.facts || coverage.sourceLinkedRows !== coverage.rows || coverage.jurisdictions !== bom.rowCounts.jurisdictions) fail("frozen coverage report drift");
const environment = JSON.parse(readFileSync(join(dir, "environment.v1.json"), "utf8"));
if (environment.packageLockSha256 !== sha(readFileSync("package-lock.json")) || environment.requiredConfiguration.length !== 0) fail("reproduction environment drift");
const citation = YAML.parse(readFileSync(join(dir, "CITATION.cff"), "utf8"));
if (citation.version !== "atlas-2026-07-11-g2-rc1" || citation["date-released"] !== "2026-07-11" || !String(citation.url).includes("civica-atlas-2026-07-11.json.gz")) fail("citation draft drift");
const cleanRoom = JSON.parse(readFileSync(join(dir, "clean-room-evidence.v1.json"), "utf8"));
if (cleanRoom.fullReleaseSemanticSha256 !== bom.files[0].semanticSha256 || cleanRoom.credentialsRequired.length || cleanRoom.runtimeNetworkRequests !== 0) fail("clean-room evidence drift");
const checklist = JSON.parse(readFileSync(join(dir, "G2-CHECKLIST.json"), "utf8"));
if (checklist.result !== "pass" || checklist.checks.some((row: { status: string }) => row.status !== "pass") || !checklist.limitationBoundaryAccepted) fail("G2 checklist is not passing");
for (const [file, phrase] of [["KNOWN-LIMITATIONS.md", "does not replay publisher ingestion"], ["REPRODUCE.md", "npm run reproduce:g2-atlas"], ["CHANGELOG.md", "frozen canonical fact rows"]]) {
  if (!readFileSync(join(dir, file), "utf8").includes(phrase)) fail(`${file} missing required release boundary`);
}

if (archiveManifest.sha256 !== sha(readFileSync(archive)) || archiveManifest.byteLength !== statSync(archive).size) fail("archival ZIP identity drift");
const zipEntries = execFileSync("/usr/bin/unzip", ["-Z1", archive], { encoding: "utf8" }).trim().split("\n").sort();
const expectedEntries = expectedFiles.map((file) => `g2-rc1/${file}`).sort();
if (JSON.stringify(zipEntries) !== JSON.stringify(expectedEntries) || JSON.stringify(archiveManifest.entries) !== JSON.stringify(expectedEntries)) fail("archival ZIP entry inventory drift");
console.log("=== DAT-022 G2 Atlas release candidate ===\n");
console.log(`Candidate: ${checklist.candidateId}`);
console.log(`Bundle files: ${expectedFiles.length}`);
console.log(`Archive bytes: ${archiveManifest.byteLength}`);
console.log(`Rows: ${bom.rowCounts.jurisdictions} jurisdictions, ${bom.rowCounts.facts} facts, ${bom.rowCounts.sources} sources`);
if (problems.length) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exit(1);
}
console.log("\nPASS — G2 inventory, code, export, inputs, rights, codebook, coverage, environment, citation, checksums, clean room, and archive agree.");
