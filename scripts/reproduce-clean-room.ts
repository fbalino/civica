import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { buildAtlasExport, serializeAtlasExport } from "../src/lib/exports/atlas-release";

const fixturePath = "data/fixtures/clean-room/atlas-input.v1.json";
const expectedPath = "data/fixtures/clean-room/expected.v1.json";

if (process.env.DATABASE_URL || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
  throw new Error("Clean-room fixture must not use database or model credentials");
}

if (process.argv.includes("--strict-clean")) {
  for (const path of [".env.local", ".next", ".turbo", ".cache"]) {
    if (existsSync(path)) throw new Error(`Strict clean-room run refuses pre-existing ${path}`);
  }
}

const fixtureBytes = readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes.toString("utf8"));
const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
const fixtureSha256 = createHash("sha256").update(fixtureBytes).digest("hex");
const release = buildAtlasExport({ jurisdictions: fixture.jurisdictions, facts: fixture.facts });
const serialized = serializeAtlasExport(release);
const exportSemanticSha256 = createHash("sha256").update(serialized).digest("hex");

if (fixture.schemaVersion !== "civica-clean-room-fixture/v1") throw new Error("Fixture schema drift");
if (fixtureSha256 !== expected.fixtureSha256) throw new Error(`Fixture hash mismatch: ${fixtureSha256}`);
if (exportSemanticSha256 !== expected.exportSemanticSha256) throw new Error(`Export hash mismatch: ${exportSemanticSha256}`);
if (JSON.stringify(release.counts) !== JSON.stringify(expected.rowCounts)) throw new Error("Row counts differ");
console.log(JSON.stringify({
  pass: true,
  fixtureSha256,
  exportSemanticSha256,
  rowCounts: release.counts,
  sources: release.tables.sources.map((row) => row.sourceId),
  credentialsUsed: [],
  networkRequests: 0,
  tolerance: expected.tolerance,
}, null, 2));
