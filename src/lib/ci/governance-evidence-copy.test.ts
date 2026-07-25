import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  "src/app/governance-evidence/page.tsx",
  "utf8",
).replace(/\s+/g, " ");

test("Governance Evidence explains the reconstructed release boundary plainly", () => {
  assert.match(
    source,
    /not retained\. This release was assembled later from harmonized publisher series and is not an as-published 2024 snapshot/,
  );
  assert.doesNotMatch(
    source,
    /none retained; this is not an as-published historical release/,
  );
});
