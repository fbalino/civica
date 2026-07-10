/** DAT-001 DB/network/clock-free production-adapter closure gate. */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  MANUAL_PRODUCTION_ADAPTERS,
  SCHEDULED_PRODUCTION_ADAPTERS,
} from "../src/lib/data/production-adapter-registry";

const ROOT = process.cwd();
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=") || "true"];
  }),
);
const releaseRef = args.get("ref") === "true" ? "HEAD" : args.get("ref");

interface Problem {
  id: string;
  detail: string;
}

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function sha256(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(path.join(ROOT, relativePath)))
    .digest("hex");
}

function pathExistsAtRef(ref: string, relativePath: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${ref}:${relativePath}`], {
      cwd: ROOT,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

const vercel = JSON.parse(read("vercel.json")) as {
  crons?: { path: string; schedule: string }[];
};
const scheduledRoutes = (vercel.crons ?? []).map((cron) => ({
  ...cron,
  file: `src/app${cron.path}/route.ts`,
}));
const registeredFiles = new Set(
  MANUAL_PRODUCTION_ADAPTERS.flatMap((adapter) => [
    adapter.entrypoint,
    ...adapter.implementationPaths,
  ]),
);
for (const route of scheduledRoutes) registeredFiles.add(route.file);
for (const adapter of SCHEDULED_PRODUCTION_ADAPTERS) {
  for (const file of adapter.implementationPaths) registeredFiles.add(file);
}

const problems: Problem[] = [];
for (const file of registeredFiles) {
  if (!existsSync(path.join(ROOT, file))) {
    problems.push({ id: "missing-working-tree-file", detail: file });
  }
  if (releaseRef && !pathExistsAtRef(releaseRef, file)) {
    problems.push({
      id: "missing-release-ref-file",
      detail: `${releaseRef}:${file}`,
    });
  }
}

const ids = MANUAL_PRODUCTION_ADAPTERS.map((adapter) => adapter.id);
if (new Set(ids).size !== ids.length) {
  problems.push({ id: "duplicate-adapter-id", detail: ids.join(", ") });
}

const orchestrator = read("scripts/ingest-ci-all.ts");
for (const script of [
  "ingest-ci-vdem.ts",
  "ingest-ci-wgi.ts",
  "ingest-ci-wgi-democracy-fallback.ts",
  "ingest-ci-freedom-house.ts",
  "ingest-ci-cpi.ts",
]) {
  if (!orchestrator.includes(script)) {
    problems.push({ id: "missing-index-orchestration", detail: script });
  }
}

const sharedIngestion = read("src/lib/ci/ingest.ts");
if (
  !/set:\s*\{[\s\S]*?sourceId:\s*result\.sourceId,[\s\S]*?ingestionId:/.test(
    sharedIngestion,
  )
) {
  problems.push({
    id: "stale-source-identity-on-upsert",
    detail:
      "src/lib/ci/ingest.ts must replace source_id when a primary source supersedes a fallback",
  });
}
for (const legacy of ["ingest-ci-hdi.ts", "ingest-ci-gpi.ts"]) {
  if (orchestrator.includes(legacy)) {
    problems.push({
      id: "legacy-index-orchestration",
      detail: `${legacy} belongs to Conditions, not the four-dimension Index`,
    });
  }
}

for (const script of [
  "scripts/ingest-ci-vdem.ts",
  "scripts/ingest-ci-wgi.ts",
  "scripts/ingest-ci-wgi-democracy-fallback.ts",
  "scripts/ingest-ci-freedom-house.ts",
  "scripts/ingest-ci-cpi.ts",
]) {
  const source = read(script);
  if (!source.includes("production-source-adapters")) {
    problems.push({ id: "noncanonical-index-parser", detail: script });
  }
  if (/const\s+(?:VDEM|WGI|FH|CPI)_20\d\d\s*:/i.test(source)) {
    problems.push({ id: "hardcoded-index-reference-table", detail: script });
  }
}

const inventory = [...registeredFiles]
  .sort()
  .filter((file) => existsSync(path.join(ROOT, file)))
  .map((file) => ({ file, sha256: sha256(file) }));

console.log("=== DAT-001 production-adapter validation ===\n");
console.log(`Scheduled cron routes: ${scheduledRoutes.length}`);
console.log(
  `Manual/Index/Conditions entries: ${MANUAL_PRODUCTION_ADAPTERS.length}`,
);
console.log(`Closed implementation files: ${inventory.length}`);
if (releaseRef) console.log(`Release ref checked: ${releaseRef}`);

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`- ${problem.id}: ${problem.detail}`);
  }
  console.error(`\nFAILED — ${problems.length} production-adapter problem(s).`);
  process.exitCode = 1;
} else {
  console.log(
    "\nPASS — scheduled and manual production adapter entrypoints are closed.",
  );
}
