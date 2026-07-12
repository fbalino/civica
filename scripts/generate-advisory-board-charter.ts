import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ADVISORY_BOARD_CHARTER, advisoryBoardCharterErrors, advisoryBoardCharterHash } from "../src/lib/research/advisory-board-charter";

const OUTPUT = resolve("data/research/advisory-board-charter-v1.json");
const WRITE = process.argv.includes("--write");
export function buildAdvisoryBoardCharterArtifact() {
  const body = { ...ADVISORY_BOARD_CHARTER };
  return { ...body, semanticSha256: advisoryBoardCharterHash(body) };
}
function main() {
  assert.deepEqual(advisoryBoardCharterErrors(), []);
  const artifact = buildAdvisoryBoardCharterArtifact();
  if (WRITE) { mkdirSync(dirname(OUTPUT), { recursive: true }); writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`); }
  else { assert.ok(existsSync(OUTPUT)); assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), artifact); }
  console.log(`PASS — ${artifact.schemaVersion}: five expertise lanes, advisory-only authority, two-year terms, bounded service, conflict/compensation/publication closure; ${artifact.semanticSha256}.`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
