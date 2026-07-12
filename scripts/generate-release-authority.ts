import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { RELEASE_AUTHORITY, releaseAuthorityErrors, releaseAuthorityHash, simulateReleaseIncident } from "../src/lib/research/release-authority";

const OUTPUT = resolve("data/research/release-correction-authority-v1.json");
const WRITE = process.argv.includes("--write");

export function buildReleaseAuthorityArtifact() {
  const body = { ...RELEASE_AUTHORITY };
  const tableTops = [
    simulateReleaseIncident({ incidentId: "tabletop-material-error", detectedAt: "2026-07-11T12:00:00.000Z", kind: "material_error", artifactId: "atlas-release", fromVersion: "v1.0.0", fromDoi: "10.0000/civica.v1", summary: "A country identity was assigned to the wrong jurisdiction.", changedFrozenBytes: true }),
    simulateReleaseIncident({ incidentId: "tabletop-method", detectedAt: "2026-07-11T12:00:00.000Z", kind: "methodology_failure", artifactId: "pulse", fromVersion: "v1.4.0-beta", fromDoi: null, summary: "The construct cannot support the published interpretation.", changedFrozenBytes: true }),
    simulateReleaseIncident({ incidentId: "tabletop-rights", detectedAt: "2026-07-11T12:00:00.000Z", kind: "security_or_rights", artifactId: "atlas-export", fromVersion: "v1.0.0", fromDoi: null, summary: "A restricted publisher payload entered a public export.", changedFrozenBytes: true }),
  ];
  return { ...body, tableTops, semanticSha256: releaseAuthorityHash({ ...body, tableTops }) };
}

function main() {
  assert.deepEqual(releaseAuthorityErrors(), []);
  const artifact = buildReleaseAuthorityArtifact();
  if (WRITE) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
  } else {
    assert.ok(existsSync(OUTPUT), "checked release-authority artifact is missing");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), artifact);
  }
  console.log(`PASS — ${artifact.schemaVersion}: named authority, three tabletop incidents, DOI/version/notice/appeal closure; ${artifact.semanticSha256}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
