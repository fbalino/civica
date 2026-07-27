import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("global election research query batches fingerprints and fails closed", () => {
  const source = readFileSync("src/lib/db/queries.ts", "utf8");
  const body = source
    .split("export async function getQualifiedElectionResearchRows()")[1]
    .split("export async function getUpcomingElections")[0];
  assert.equal(
    (body.match(/loadLiveElectionContentFingerprints\(/g) ?? []).length,
    1,
  );
  assert.match(body, /isAuditedPublicElection/);
  assert.match(body, /isAuditedProjection/);
  assert.match(body, /isEligibleElectionField/);
  assert.match(body, /eventSourceUrl/);
});
