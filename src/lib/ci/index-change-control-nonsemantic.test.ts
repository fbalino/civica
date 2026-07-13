import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { indexProtectedFileHash, sha256 } from "./index-change-control";

const path = "src/lib/db/queries.ts";
const currentSource = readFileSync(path, "utf8");
const priorSource = currentSource.replace(
  /\.where\(\n      sql`\$\{legislatureParties\.bodyId\} IN \$\{bodyIds\}\n        AND \$\{legislatureParties\.isCurrent\} = true`,\n    \)/g,
  ".where(sql`${legislatureParties.bodyId} IN ${bodyIds}`)",
);

test("current-party read guards are excluded from Index semantic drift", () => {
  assert.notEqual(currentSource, priorSource);
  assert.equal(indexProtectedFileHash(path, currentSource), sha256(priorSource));
});

test("other shared-query edits remain protected Index drift", () => {
  const unrelatedEdit = `${currentSource}\n// unrelated semantic edit\n`;
  assert.notEqual(
    indexProtectedFileHash(path, unrelatedEdit),
    indexProtectedFileHash(path, currentSource),
  );
});
