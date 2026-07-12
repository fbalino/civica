import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  PUBLICATION_GOVERNANCE_CHARTER,
  publicationGovernanceErrors,
  publicationGovernanceHash,
} from "../src/lib/research/publication-governance";

const OUTPUT = resolve("data/research/publication-governance-charter-v1.json");
const WRITE = process.argv.includes("--write");

export function buildPublicationGovernanceArtifact() {
  const body = { ...PUBLICATION_GOVERNANCE_CHARTER };
  return { ...body, semanticSha256: publicationGovernanceHash(body) };
}

function main() {
  assert.deepEqual(publicationGovernanceErrors(), []);
  const artifact = buildPublicationGovernanceArtifact();
  if (WRITE) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
  } else {
    assert.ok(existsSync(OUTPUT), "checked publication-governance artifact is missing");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), artifact);
  }
  console.log(`PASS — ${artifact.schemaVersion}: ${artifact.decisions.length} named decision domains; ${artifact.semanticSha256}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
