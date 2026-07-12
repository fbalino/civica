import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AI_USE_DISCLOSURE, aiUseDisclosureErrors, aiUseDisclosureHash } from "../src/lib/research/ai-use-disclosure";

const OUTPUT = resolve("data/research/ai-use-disclosure-v1.json");
const WRITE = process.argv.includes("--write");

export function buildAiUseDisclosureArtifact() {
  const body = { ...AI_USE_DISCLOSURE };
  return { ...body, semanticSha256: aiUseDisclosureHash(body) };
}

function main() {
  assert.deepEqual(aiUseDisclosureErrors(), []);
  const artifact = buildAiUseDisclosureArtifact();
  if (WRITE) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
  } else {
    assert.ok(existsSync(OUTPUT), "checked AI-use disclosure is missing");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), artifact);
  }
  console.log(`PASS — ${artifact.schemaVersion}: ${artifact.uses.length} material use categories; ${artifact.semanticSha256}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
