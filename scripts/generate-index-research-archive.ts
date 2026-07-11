import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

import {
  INDEX_RESEARCH_ARCHIVE,
  indexResearchArchiveErrors,
  indexResearchArchiveSemanticHash,
  type IndexResearchArchiveManifest,
} from "../src/lib/ci/index-research-archive";

const outputDir = `data/releases/${INDEX_RESEARCH_ARCHIVE.releaseId}`;
const tournament = JSON.parse(readFileSync("data/releases/index-tournament-results-package-v1/manifest.v1.json", "utf8"));
const decision = JSON.parse(readFileSync("data/releases/index-tournament-confirmatory-decision-v1/decision.v1.json", "utf8"));
const disposition = JSON.parse(readFileSync("data/releases/index-disposition-2026-07-v1/resolution.v1.json", "utf8"));
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

mkdirSync(outputDir, { recursive: true });
execFileSync("git", [
  "archive",
  "--format=tar.gz",
  `--output=${INDEX_RESEARCH_ARCHIVE.codeSnapshotPath}`,
  INDEX_RESEARCH_ARCHIVE.sourceCommit,
  "--",
  ...tournament.code.files.map((row: { path: string }) => row.path),
]);

const snapshotBytes = readFileSync(INDEX_RESEARCH_ARCHIVE.codeSnapshotPath);
const base = {
  ...INDEX_RESEARCH_ARCHIVE,
  tournament: {
    releaseId: tournament.releaseId,
    winnerSelected: tournament.winnerSelected,
    artifacts: tournament.artifacts,
    errorLedger: tournament.errorLedger,
  },
  decision: {
    releaseId: decision.releaseId,
    outcome: decision.outcome,
    winnerSelected: decision.winnerSelected,
  },
  disposition: {
    releaseId: disposition.releaseId,
    status: disposition.status,
    selectedDisposition: disposition.selectedDisposition,
  },
  code: {
    treeSha256: tournament.code.treeSha256,
    files: tournament.code.files,
    snapshot: {
      path: INDEX_RESEARCH_ARCHIVE.codeSnapshotPath,
      bytes: statSync(INDEX_RESEARCH_ARCHIVE.codeSnapshotPath).size,
      sha256: sha256(snapshotBytes),
    },
  },
  failedThresholds: decision.thresholds.filter((row: { status: string }) => row.status === "fail"),
  nullResults: decision.thresholds.filter((row: { status: string }) => row.status === "insufficient_evidence"),
  verificationArtifacts: [
    "data/releases/index-tournament-results-package-v1/manifest.v1.json",
    "data/releases/index-tournament-confirmatory-decision-v1/decision.v1.json",
    "data/releases/index-disposition-2026-07-v1/resolution.v1.json",
    "data/releases/governance-evidence-review-packet-2026-07-v1/manifest.v1.json",
  ].map((path) => {
    const bytes = readFileSync(path);
    return { path, bytes: bytes.byteLength, sha256: sha256(bytes) };
  }),
} as IndexResearchArchiveManifest;
const manifest = { ...base, archiveSemanticSha256: indexResearchArchiveSemanticHash(base) };
const errors = indexResearchArchiveErrors(manifest);
if (errors.length > 0) throw new Error(errors.join("\n"));

writeFileSync(`${outputDir}/manifest.v1.json`, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(
  `${outputDir}/README.md`,
  `# Civica Index research archive v1\n\nThis immutable package preserves K1–K5 code, artifact identities, failed thresholds, null or insufficient results, and reasons. None of the archived candidates is a recommended public product. The selected public product remains the source-native Governance Evidence Dashboard.\n\nRestricted country-level publisher observations are not copied into this archive. The manifest retains their rights-safe release identities and hashes.\n\n## Verify\n\n\`\`\`sh\n${INDEX_RESEARCH_ARCHIVE.validationCommand}\n\`\`\`\n`,
);

console.log(`PASS — ${manifest.releaseId}: ${manifest.code.files.length} code files, ${manifest.tournament.artifacts.length} artifacts, ${manifest.failedThresholds.length} failures, ${manifest.nullResults.length} null/insufficient results.`);
