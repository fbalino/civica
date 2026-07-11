import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

import {
  INDEX_CHANGE_CATEGORIES,
  currentIndexSnapshot,
  indexChangeControlErrors,
  indexEvidence,
  indexSnapshotSha256,
  requiredIndexValidations,
  type IndexChangeCategory,
  type IndexChangeRegistry,
  type IndexChangeEvidenceRole,
} from "../src/lib/ci/index-change-control";

const outputDir = "data/releases/index-change-control-v1";
const outputPath = `${outputDir}/registry.v1.json`;
const initialize = process.argv.includes("--initialize");
const metadataArg = process.argv.find((arg) => arg.startsWith("--metadata="));

type Metadata = {
  id: string;
  toVersion: string;
  categories?: IndexChangeCategory[];
  evidence: Record<IndexChangeEvidenceRole, string[]>;
  validations?: string[];
};

function changedPaths(before: IndexChangeRegistry["entries"][number]["protectedFiles"], after: IndexChangeRegistry["entries"][number]["protectedFiles"]) {
  const prior = new Map(before.map((row) => [row.path, row.sha256]));
  return after.filter((row) => prior.get(row.path) !== row.sha256);
}

const snapshot = currentIndexSnapshot();
if (initialize) {
  if (existsSync(outputPath) && !process.argv.includes("--force-initialize")) {
    throw new Error("The change-control registry already exists. Append with --metadata; do not reset its history.");
  }
  const categories = [...INDEX_CHANGE_CATEGORIES];
  const evidence = indexEvidence({
    documentation: ["content/methodology-civica-index.md", "data/releases/governance-evidence-review-packet-2026-07-v1/README.md"],
    registry: ["src/lib/claims/public-claims.ts", "src/lib/content/site-state.ts"],
    release_note: ["plan/evidence/IDX-027/README.md", "plan/evidence/IDX-029/README.md"],
    migration_plan: ["plan/evidence/IDX-027/README.md"],
    golden_test: ["src/lib/ci/governance-evidence.test.ts", "src/lib/ci/index-research-archive.test.ts"],
    contract_test: ["src/lib/ci/index-disposition.test.ts", "src/lib/ci/quarantine-contract.test.ts"],
  });
  const entry = {
    id: "adopted-source-native-disposition-baseline",
    fromVersion: "ci-beta-r5-2024-Q4",
    toVersion: "civica-index-disposition-2026-07-v1",
    parentSnapshotSha256: null,
    snapshotSha256: indexSnapshotSha256(snapshot),
    categories,
    changedPaths: snapshot.map((row) => row.path),
    protectedFiles: snapshot,
    evidence,
    validations: requiredIndexValidations(categories),
  };
  const registry: IndexChangeRegistry = {
    schemaVersion: "civica-index-change-control/v1",
    policy: {
      appendOnly: true,
      updateCommand: "npm run generate:index-change-control -- --metadata=path/to/change.json",
      ciCommand: "npm run validate:index-change-control:run",
    },
    entries: [entry],
    currentSnapshotSha256: entry.snapshotSha256,
  };
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`Initialized ${registry.schemaVersion} at ${entry.snapshotSha256}.`);
} else {
  if (!metadataArg) throw new Error("Pass --initialize once or --metadata=path/to/change.json for an append-only change record.");
  const registry = JSON.parse(readFileSync(outputPath, "utf8")) as IndexChangeRegistry;
  const metadata = JSON.parse(readFileSync(metadataArg.slice("--metadata=".length), "utf8")) as Metadata;
  const prior = registry.entries.at(-1);
  if (!prior) throw new Error("Registry has no baseline.");
  const changed = changedPaths(prior.protectedFiles, snapshot);
  const categories = [...new Set(changed.map((row) => row.category))];
  if (metadata.categories && metadata.categories.slice().sort().join() !== categories.slice().sort().join()) throw new Error("Metadata categories do not match the protected-file diff.");
  const entry = {
    id: metadata.id,
    fromVersion: prior.toVersion,
    toVersion: metadata.toVersion,
    parentSnapshotSha256: prior.snapshotSha256,
    snapshotSha256: indexSnapshotSha256(snapshot),
    categories,
    changedPaths: changed.map((row) => row.path),
    protectedFiles: snapshot,
    evidence: indexEvidence(metadata.evidence),
    validations: metadata.validations ?? requiredIndexValidations(categories),
  };
  const next = { ...registry, entries: [...registry.entries, entry], currentSnapshotSha256: entry.snapshotSha256 };
  const errors = indexChangeControlErrors(next, snapshot);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  writeFileSync(outputPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Appended ${entry.id}: ${entry.fromVersion} → ${entry.toVersion}.`);
}
