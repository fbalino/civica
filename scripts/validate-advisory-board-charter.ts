import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { advisoryBoardCharterErrors } from "../src/lib/research/advisory-board-charter";
import { buildAdvisoryBoardCharterArtifact } from "./generate-advisory-board-charter";

assert.deepEqual(advisoryBoardCharterErrors(), []);
assert.deepEqual(JSON.parse(readFileSync("data/research/advisory-board-charter-v1.json", "utf8")), buildAdvisoryBoardCharterArtifact());
const page = readFileSync("src/app/about/advisory-board/page.tsx", "utf8");
assert.ok(page.includes("ADVISORY_BOARD_CHARTER") && page.includes("charter.schemaVersion"));
for (const phrase of ["Advisory, not an endorsement", "Terms and workload", "Conflicts and independence", "Confidentiality and publication", "Compensation", "Resignation and removal", "No members have been appointed"])
  assert.ok(page.includes(phrase), `advisory page missing: ${phrase}`);
assert.equal(/style=\{\{/.test(page), false, "advisory charter page contains ad-hoc inline layout styles");
console.log("PASS — public charter covers purpose, expertise, advisory/nonendorsement status, term, workload, confidentiality, conflicts, compensation, removal, consented publication, and an honest empty roster.");
