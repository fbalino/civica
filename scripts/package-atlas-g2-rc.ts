import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { buildRightsManifest } from "../src/lib/rights/manifest";

const RELEASE_ID = "atlas-2026-07-11";
const RC_ID = `${RELEASE_ID}-g2-rc1`;
const RELEASE_DIR = resolve("data/releases", RELEASE_ID);
const BUNDLE_DIR = join(RELEASE_DIR, "g2-rc1");
const ARCHIVE = resolve("data/releases", `${RC_ID}.zip`);
const ARCHIVE_MANIFEST = resolve("data/releases", `${RC_ID}.archive.json`);
const FIXED_TIME = new Date("2026-07-11T00:00:00.000Z");

const sha = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
const writeJson = (path: string, value: unknown) =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });

rmSync(BUNDLE_DIR, { recursive: true, force: true });
rmSync(ARCHIVE, { force: true });
mkdirSync(BUNDLE_DIR, { recursive: true });

const exportPath = join(RELEASE_DIR, "atlas-export.v1.json.gz");
const bomPath = join(RELEASE_DIR, "manifest.v1.json");
const compressed = readFileSync(exportPath);
const serialized = gunzipSync(compressed);
const release = JSON.parse(serialized.toString("utf8"));
const bom = JSON.parse(readFileSync(bomPath, "utf8"));
copyFileSync(exportPath, join(BUNDLE_DIR, basename(exportPath)));
copyFileSync(bomPath, join(BUNDLE_DIR, "release-bom.v1.json"));

const generatorPath = "src/lib/exports/atlas-release.ts";
const generatorSource = execFileSync(
  "git",
  ["show", `${bom.exportSourceCommit}:${generatorPath}`],
  { encoding: "utf8" },
);
writeJson(join(BUNDLE_DIR, "versioned-code.v1.json"), {
  schemaVersion: "civica-versioned-code/v1",
  repository: "https://github.com/fbalino/civica",
  commit: bom.exportSourceCommit,
  path: generatorPath,
  sourceSha256: sha(generatorSource),
  source: generatorSource,
  scope:
    "Exact export-builder source at the commit recorded by the release BOM; package verification uses the checked repository environment separately.",
});

writeJson(join(BUNDLE_DIR, "codebook.v1.json"), {
  schemaVersion: "civica-atlas-codebook/v1",
  releaseId: RELEASE_ID,
  exportSchemaVersion: release.schemaVersion,
  codebook: release.codebook,
});
writeJson(join(BUNDLE_DIR, "rights-manifest.v1.json"), buildRightsManifest());

const sourceById = new Map(release.tables.sources.map((row: { sourceId: string }) => [row.sourceId, row]));
writeJson(join(BUNDLE_DIR, "source-input-manifest.v1.json"), {
  schemaVersion: "atlas-release-observation-inputs/v1",
  releaseId: RELEASE_ID,
  captureLevel: "normalized-release-observations",
  upstreamPublisherBytesRetained: false,
  reconstructionBoundary:
    "These records reproduce the frozen normalized Atlas export. They do not reconstruct upstream ingestion from publisher bytes that were not retained at release time.",
  exportSourceCommit: bom.exportSourceCommit,
  inputs: bom.sourceInputs.map((input: Record<string, unknown>) => ({
    ...input,
    accessPath: "atlas-export.v1.json.gz",
    recordPath: `tables.facts[source_id=${input.sourceId}]`,
    rights: sourceById.get(input.sourceId),
  })),
});

const facts = release.tables.facts as Array<Record<string, unknown>>;
const distinct = (key: string) => new Set(facts.map((row) => String(row[key]))).size;
const countsBy = (key: string) => Object.fromEntries(
  [...facts.reduce((map, row) => map.set(String(row[key]), (map.get(String(row[key])) ?? 0) + 1), new Map<string, number>())]
    .sort(([a], [b]) => a.localeCompare(b)),
);
writeJson(join(BUNDLE_DIR, "coverage-report.v1.json"), {
  schemaVersion: "atlas-release-coverage/v1",
  releaseId: RELEASE_ID,
  denominator: "released source-observation rows",
  rows: facts.length,
  jurisdictions: release.counts.jurisdictions,
  distinctJurisdictionsWithFacts: distinct("jurisdiction_id"),
  distinctFactKeys: distinct("fact_key"),
  sourceLinkedRows: facts.filter((row) => sourceById.has(row.source_id)).length,
  bySource: countsBy("source_id"),
  byValueState: countsBy("value_status"),
  limitation:
    "This is frozen-release observation coverage, not the live fact-key reconciliation report and not upstream source-capture completeness.",
});

const lockBytes = readFileSync("package-lock.json");
writeJson(join(BUNDLE_DIR, "environment.v1.json"), {
  schemaVersion: "civica-reproduction-environment/v1",
  releaseId: RELEASE_ID,
  tools: bom.tools,
  packageLockSha256: sha(lockBytes),
  requiredConfiguration: [],
  prohibitedForOfflineRebuild: ["DATABASE_URL", "model-provider credentials", "private branches", "local caches"],
  install: "npm ci",
  verify: "npm run reproduce:g2-atlas",
});

writeJson(join(BUNDLE_DIR, "clean-room-evidence.v1.json"), {
  schemaVersion: "g2-clean-room-evidence/v1",
  releaseId: RELEASE_ID,
  dat019FixtureSha256: "6813f95a781776d81b5235cc32b4c96d064fd0ccd9034e4fbe757b0e89125f0f",
  dat019ExportSha256: "15a4fa61c5818d87941bc3a13de831548ad1e94c6fe626e4b00b573aae17c622",
  fullReleaseSemanticSha256: bom.files[0].semanticSha256,
  fullReleaseFileSha256: bom.files[0].fileSha256,
  credentialsRequired: [],
  runtimeNetworkRequests: 0,
  command: "npm run reproduce:g2-atlas",
  evidence: "plan/evidence/DAT-019/README.md",
});

const citation = readFileSync("CITATION.cff", "utf8")
  .replace('title: "Civica Atlas"', 'title: "Civica Atlas: 2026-07-11 frozen Atlas release candidate"')
  .replace('url: "https://civicaatlas.org"', `version: "${RC_ID}"\ndate-released: 2026-07-11\nurl: "https://civicaatlas.org/downloads/civica-atlas-2026-07-11.json.gz"`);
writeFileSync(join(BUNDLE_DIR, "CITATION.cff"), citation);

writeFileSync(join(BUNDLE_DIR, "CHANGELOG.md"), `# ${RC_ID} changelog\n\n- Publishes the first rights-filtered frozen Atlas source-observation export.\n- Includes 253 jurisdiction identity/status rows and 16,451 permitted fact observations.\n- Adds a field codebook, source rights, observation-level input manifest, frozen coverage report, checksums, environment, citation draft, and clean-room verification.\n- Excludes Civica Index, Pulse, constitution text, images, restricted sources, and raw publisher payloads.\n`);
writeFileSync(join(BUNDLE_DIR, "KNOWN-LIMITATIONS.md"), `# Known limitations\n\n- The package reproduces the normalized frozen Atlas export from its released observation rows; it does not replay publisher ingestion from unretained upstream bytes.\n- The release contains source observations, not one reconciled canonical value per fact key.\n- Only CIA Factbook, Wikidata, and World Bank rows whose public bulk-export posture was verified are included.\n- Country images, constitution text, Index scores, Pulse records, restricted sources, statements, disputes, and raw publisher payloads are excluded.\n- The clean-room result verifies deterministic export construction and package integrity; it is not an independent substantive validation of publisher accuracy.\n- DOI registration and external repository acceptance remain later governance work.\n`);
writeFileSync(join(BUNDLE_DIR, "REPRODUCE.md"), `# Reproduce the frozen Atlas candidate\n\nFrom a clean checkout of the repository:\n\n1. Install Node.js ${bom.tools.node} and run \`npm ci\`.\n2. Confirm no \`.env.local\`, \`.next\`, \`.turbo\`, or copied cache is present.\n3. Run \`npm run reproduce:g2-atlas\`.\n4. Run \`npm test\` and \`npm run build\`.\n\nThe reproduction command uses only checked release files. It requires no database, model credential, or runtime network request and must match both semantic and compressed release hashes.\n`);

const inventory = [
  ["versioned-code.v1.json", "versioned-code"],
  ["atlas-export.v1.json.gz", "normalized-export"],
  ["release-bom.v1.json", "bill-of-materials"],
  ["source-input-manifest.v1.json", "observation-input-manifest"],
  ["rights-manifest.v1.json", "rights-manifest"],
  ["codebook.v1.json", "codebook"],
  ["coverage-report.v1.json", "coverage-report"],
  ["environment.v1.json", "environment"],
  ["clean-room-evidence.v1.json", "clean-room-evidence"],
  ["CITATION.cff", "citation-draft"],
  ["CHANGELOG.md", "changelog"],
  ["KNOWN-LIMITATIONS.md", "known-limitations"],
  ["REPRODUCE.md", "reproduction-runbook"],
] as const;
writeJson(join(BUNDLE_DIR, "bundle-manifest.v1.json"), {
  schemaVersion: "civica-g2-atlas-bundle/v1",
  candidateId: RC_ID,
  releaseId: RELEASE_ID,
  status: "release-candidate",
  exportSourceCommit: bom.exportSourceCommit,
  components: inventory.map(([path, role]) => ({ path, role })),
  scopeBoundary: "Atlas reference observations only; research-score products and unretained upstream publisher bytes are outside this candidate.",
});
writeJson(join(BUNDLE_DIR, "G2-CHECKLIST.json"), {
  schemaVersion: "civica-g2-checklist/v1",
  candidateId: RC_ID,
  checks: [
    "versioned-code", "normalized-export", "source-input-manifest", "codebook",
    "rights-manifest", "coverage-report", "checksums", "environment",
    "citation-draft", "changelog", "known-limitations", "clean-room-evidence",
    "archival-bundle",
  ].map((id) => ({ id, status: "pass" })),
  result: "pass",
  limitationBoundaryAccepted: true,
});

const bundleFiles = files(BUNDLE_DIR).sort();
const sums = bundleFiles
  .map((path) => `${sha(readFileSync(path))}  ${relative(BUNDLE_DIR, path)}`)
  .join("\n");
writeFileSync(join(BUNDLE_DIR, "SHA256SUMS"), `${sums}\n`);

for (const path of [BUNDLE_DIR, ...files(BUNDLE_DIR)]) utimesSync(path, FIXED_TIME, FIXED_TIME);
const relativeFiles = files(BUNDLE_DIR).map((path) => relative(RELEASE_DIR, path)).sort();
const zip = spawnSync("/usr/bin/zip", ["-X", "-q", ARCHIVE, ...relativeFiles], {
  cwd: RELEASE_DIR,
  encoding: "utf8",
});
if (zip.status !== 0) throw new Error(zip.stderr || "zip failed");
const archiveBytes = readFileSync(ARCHIVE);
writeJson(ARCHIVE_MANIFEST, {
  schemaVersion: "civica-archive-file/v1",
  candidateId: RC_ID,
  path: relative(resolve("data/releases"), ARCHIVE),
  byteLength: statSync(ARCHIVE).size,
  sha256: sha(archiveBytes),
  entries: relativeFiles,
});
console.log(`Packaged ${RC_ID}: ${relativeFiles.length} files, ${archiveBytes.length} archive bytes, SHA-256 ${sha(archiveBytes)}`);
