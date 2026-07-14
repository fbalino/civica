import assert from "node:assert/strict";
import test from "node:test";

import { summarizeCronReports } from "./cron-output";

test("cron report summaries retain status without serializing provider details", () => {
  const secretFragments = [
    "postgres://sync-user:database-password@private-db/civica",
    "provider-api-key-secret",
  ];
  const reports = summarizeCronReports([
    { source: "first", fetched: 0, error: secretFragments.join(" | ") },
    { source: "second", fetched: 4 },
  ]);

  assert.deepEqual(reports, [
    { source: "first", fetched: 0, failed: true },
    { source: "second", fetched: 4, failed: false },
  ]);
  const responseBody = JSON.stringify({ summary: { reports } });
  for (const fragment of secretFragments) {
    assert.equal(responseBody.includes(fragment), false);
  }
});
