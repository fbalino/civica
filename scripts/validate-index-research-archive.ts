import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

import {
  INDEX_RESEARCH_ARCHIVE,
  indexResearchArchiveErrors,
  type IndexResearchArchiveManifest,
} from "../src/lib/ci/index-research-archive";
import { INDEX_DISPOSITION, indexDispositionErrors } from "../src/lib/ci/index-disposition";

const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const path = `data/releases/${INDEX_RESEARCH_ARCHIVE.releaseId}/manifest.v1.json`;
const manifest = JSON.parse(readFileSync(path, "utf8")) as IndexResearchArchiveManifest;

assert.deepEqual(indexResearchArchiveErrors(manifest), []);
assert.deepEqual(indexDispositionErrors(), []);
assert.equal(INDEX_DISPOSITION.k1Composite.standing, "retained_versioned_research_not_publicly_recommended");

const snapshot = readFileSync(manifest.code.snapshot.path);
assert.equal(snapshot.byteLength, manifest.code.snapshot.bytes, "code snapshot byte drift");
assert.equal(sha256(snapshot), manifest.code.snapshot.sha256, "code snapshot hash drift");
const archivedPaths = execFileSync("tar", ["-tzf", manifest.code.snapshot.path], { encoding: "utf8" })
  .trim().split("\n").filter((entry) => entry && !entry.endsWith("/")).sort();
assert.deepEqual(archivedPaths, manifest.code.files.map((row) => row.path).sort(), "code snapshot inventory drift");
for (const file of manifest.code.files) {
  const bytes = execFileSync("tar", ["-xOzf", manifest.code.snapshot.path, file.path]);
  assert.equal(sha256(bytes), file.sha256, `${file.path} frozen code hash drift`);
}

for (const artifact of manifest.tournament.artifacts) {
  const bytes = readFileSync(artifact.path);
  assert.equal(bytes.byteLength, artifact.bytes, `${artifact.id} byte drift`);
  assert.equal(sha256(bytes), artifact.sha256, `${artifact.id} hash drift`);
}
for (const artifact of manifest.verificationArtifacts as Array<{ path: string; bytes: number; sha256: string }>) {
  const bytes = readFileSync(artifact.path);
  assert.equal(statSync(artifact.path).size, artifact.bytes, `${artifact.path} byte drift`);
  assert.equal(sha256(bytes), artifact.sha256, `${artifact.path} hash drift`);
}

console.log(`PASS — ${manifest.releaseId}: ${manifest.code.files.length} frozen code files and ${manifest.tournament.artifacts.length} research artifacts remain verifiable; K1–K5 remain not recommended.`);
