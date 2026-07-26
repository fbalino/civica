import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  PROJECT_DISCLOSURE,
  PROJECT_DISCLOSURE_ARTIFACT_PATH,
  projectDisclosureErrors,
  projectDisclosureHash,
} from "../src/lib/research/project-disclosure";

const OUTPUT = resolve(PROJECT_DISCLOSURE_ARTIFACT_PATH);
const WRITE = process.argv.includes("--write");

export function buildProjectDisclosureArtifact() {
  const body = { ...PROJECT_DISCLOSURE };
  return { ...body, semanticSha256: projectDisclosureHash(body) };
}

function main() {
  assert.deepEqual(projectDisclosureErrors(), []);
  const artifact = buildProjectDisclosureArtifact();
  if (WRITE) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
  } else {
    assert.ok(existsSync(OUTPUT), "checked project disclosure is missing");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), artifact);
  }
  console.log(
    `PASS — ${artifact.schemaVersion}: owner-approved disclosure; ${artifact.semanticSha256}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
