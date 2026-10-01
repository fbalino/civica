import assert from "node:assert/strict";
import test from "node:test";

import { persistProposedDisputes } from "../dispute-persistence";

test("expired dispute deadline performs no resolver or database work", async () => {
  let dbCalls = 0;
  const db = new Proxy({}, {
    get() {
      dbCalls++;
      throw new Error("database should not be touched");
    },
  });

  const result = await persistProposedDisputes(
    db as never,
    [{ jurisdictionId: "11111111-1111-4111-8111-111111111111", factKey: "population_total" }],
    { deadlineAtMs: Date.now() - 1 },
  );

  assert.match(result.errors.join(" "), /terminal deadline exhausted/);
  assert.equal(dbCalls, 0);
});
