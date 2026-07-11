import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { TOURNAMENT_ERROR_LEDGER, TOURNAMENT_PACKAGE_ARTIFACTS, TOURNAMENT_REPRODUCTION_COMMANDS, TOURNAMENT_RESULTS_PACKAGE_ID, buildArtifactInventoryCsv, packageSha256, tournamentResultsPackageErrors } from "../src/lib/ci/tournament-results-package";
import { INDEX_READER_TASK_PROTOCOL_SHA256 } from "../src/lib/ci/reader-task-protocol";
import { researchPanelHash } from "../src/lib/ci/research-panel";
import { INDEX_TOURNAMENT_PREREGISTRATION, INDEX_TOURNAMENT_PROTOCOL_VERSION } from "../src/lib/ci/tournament-preregistration";

const root = process.cwd();
const outputDir = "data/releases/index-tournament-results-package-v1";
const logDir = `${outputDir}/logs`;
const verifyOnly = process.argv.includes("--verify-only");
const sanitize = (text: string) => text.split("\n").filter((line) => !line.includes("injected env") && !line.includes("dotenvx.com")).join("\n").trim();

mkdirSync(logDir, { recursive: true });
if (!verifyOnly) {
  for (const command of TOURNAMENT_REPRODUCTION_COMMANDS) {
    const args = ["run", command.script, ...(command.args.length ? ["--", ...command.args] : [])];
    try {
      const stdout = execFileSync("npm", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 20 * 1024 * 1024 });
      writeFileSync(`${logDir}/${command.id}.log`, `${JSON.stringify({ command: `npm ${args.join(" ")}`, exitCode: 0 })}\n${sanitize(stdout)}\n`);
    } catch (error: any) {
      const stdout = sanitize(String(error.stdout ?? ""));
      const stderr = sanitize(String(error.stderr ?? ""));
      writeFileSync(`${logDir}/${command.id}.log`, `${JSON.stringify({ command: `npm ${args.join(" ")}`, exitCode: error.status ?? 1 })}\n${stdout}\n${stderr}\n`);
      throw error;
    }
  }
}

const artifacts = TOURNAMENT_PACKAGE_ARTIFACTS.map((artifact) => {
  const bytes = readFileSync(artifact.path);
  return { ...artifact, bytes: bytes.byteLength, sha256: packageSha256(bytes) };
});
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const commandCodePaths = TOURNAMENT_REPRODUCTION_COMMANDS.map((command) => String(packageJson.scripts[command.script]).match(/scripts\/[^\s]+\.ts/)?.[0]).filter((path): path is string => Boolean(path));
const codePaths = [...new Set([
  ...readdirSync("src/lib/ci").filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts")).map((path) => `src/lib/ci/${path}`),
  ...commandCodePaths,
  "scripts/reproduce-index-tournament-package.ts",
  "scripts/validate-index-tournament-package.ts",
])].sort();
const code = codePaths.map((path) => ({ path, sha256: packageSha256(readFileSync(path)) }));
const inventory = buildArtifactInventoryCsv(artifacts);
writeFileSync(`${outputDir}/artifact-inventory.v1.csv`, inventory);
const errorLedger = { schemaVersion: "civica-index-tournament-error-ledger/v1", releaseId: TOURNAMENT_RESULTS_PACKAGE_ID, entries: TOURNAMENT_ERROR_LEDGER };
const errorLedgerText = `${JSON.stringify(errorLedger, null, 2)}\n`;
writeFileSync(`${outputDir}/error-ledger.v1.json`, errorLedgerText);
const logs = TOURNAMENT_REPRODUCTION_COMMANDS.map((command) => ({ id: command.id, path: `${logDir}/${command.id}.log`, sha256: packageSha256(readFileSync(`${logDir}/${command.id}.log`)) }));
const manifest = {
  schemaVersion: "civica-index-tournament-results-package/v1",
  releaseId: TOURNAMENT_RESULTS_PACKAGE_ID,
  protocolVersion: INDEX_TOURNAMENT_PROTOCOL_VERSION,
  protocolSha256: researchPanelHash(INDEX_TOURNAMENT_PREREGISTRATION),
  readerProtocolSha256: INDEX_READER_TASK_PROTOCOL_SHA256,
  environment: { node: process.version, npm: execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(), platform: platform(), platformRelease: release(), arch: arch(), packageLockSha256: packageSha256(readFileSync("package-lock.json")) },
  seeds: ["civica-index-validity-bootstrap-v1", "civica-index-incremental-bootstrap-v1", "civica-longitudinal-bootstrap-v1", "index-reader-task-protocol-v1"],
  code: { files: code, treeSha256: packageSha256(JSON.stringify(code)) },
  artifacts,
  tables: ["data/releases/index-dimensionality-analysis-v1/table.v1.csv", `${outputDir}/artifact-inventory.v1.csv`],
  figures: ["data/releases/index-dimensionality-analysis-v1/pc1-level-comparison.v1.svg"],
  errorLedger: { path: `${outputDir}/error-ledger.v1.json`, sha256: packageSha256(errorLedgerText), entries: TOURNAMENT_ERROR_LEDGER.length },
  reproduction: { command: "npm run reproduce:index-tournament-package", commands: TOURNAMENT_REPRODUCTION_COMMANDS, logs },
  analysisSeparation: { confirmatoryArtifacts: artifacts.filter((row) => row.analysisClass === "confirmatory").map((row) => row.id), exploratoryArtifacts: [], policy: "Only preregistered confirmatory artifacts enter this release. Any threshold or analysis added after results must ship in a separately labelled exploratory release and cannot replace these files." },
  rights: { publicValuesIncluded: false, posture: "Manifests, aggregate results, tables, and figures only; restricted country-level source values remain private." },
  winnerSelected: false,
};
const errors = tournamentResultsPackageErrors(manifest);
if (errors.length) throw new Error(errors.join("\n"));
writeFileSync(`${outputDir}/manifest.v1.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`PASS — ${TOURNAMENT_RESULTS_PACKAGE_ID}: ${artifacts.length} artifacts, ${logs.length} reproducible stages, no winner selected.`);
