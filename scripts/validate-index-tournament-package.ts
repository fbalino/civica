import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOURNAMENT_PACKAGE_ARTIFACTS, packageSha256, tournamentResultsPackageErrors } from "../src/lib/ci/tournament-results-package";

const path = "data/releases/index-tournament-results-package-v1/manifest.v1.json";
const manifest = JSON.parse(readFileSync(path, "utf8"));
assert.deepEqual(tournamentResultsPackageErrors(manifest), []);
for (const artifact of TOURNAMENT_PACKAGE_ARTIFACTS) {
  const checked = manifest.artifacts.find((row: any) => row.id === artifact.id);
  assert.ok(checked, `missing ${artifact.id}`);
  const bytes = readFileSync(artifact.path);
  assert.equal(checked.sha256, packageSha256(bytes), `${artifact.id} hash drift`);
  assert.equal(checked.bytes, bytes.byteLength, `${artifact.id} byte count drift`);
}
for (const code of manifest.code.files) assert.equal(code.sha256, packageSha256(readFileSync(code.path)), `${code.path} code drift`);
assert.equal(manifest.code.treeSha256, packageSha256(JSON.stringify(manifest.code.files)), "code tree drift");
assert.equal(manifest.errorLedger.sha256, packageSha256(readFileSync(manifest.errorLedger.path)), "error ledger drift");
for (const log of manifest.reproduction.logs) assert.equal(log.sha256, packageSha256(readFileSync(log.path)), `${log.id} log drift`);
console.log(`PASS — ${manifest.releaseId} closes ${manifest.artifacts.length} artifacts and ${manifest.reproduction.logs.length} canonical logs.`);
