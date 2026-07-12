import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AUTHORSHIP_RECORD, authorshipErrors, authorshipHash } from "../src/lib/research/authorship";

const OUTPUT = resolve("data/research/authorship-and-contributions-v1.json");
const WRITE = process.argv.includes("--write");

export function buildAuthorshipArtifact() {
  const body = { ...AUTHORSHIP_RECORD };
  return { ...body, semanticSha256: authorshipHash(body) };
}

function main() {
  assert.deepEqual(authorshipErrors(), []);
  const artifact = buildAuthorshipArtifact();
  if (WRITE) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
  } else {
    assert.ok(existsSync(OUTPUT), "checked authorship artifact is missing");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), artifact);
  }
  console.log(`PASS — ${artifact.schemaVersion}: one responsible human, ${artifact.responsibleAuthor.roles.length} roles, ${artifact.contributionHistory.length} history periods.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
