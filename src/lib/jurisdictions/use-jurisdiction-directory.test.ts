import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { loadJurisdictionDirectory } from "./use-jurisdiction-directory";

test("a failed directory load retries on its own while the field stays focused", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  console.error = () => {};
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) return new Response("unavailable", { status: 503 });
    return Response.json({
      rows: [
        {
          slug: "uruguay",
          name: "Uruguay",
          iso2: "UY",
          iso3: "URY",
          capital: "Montevideo",
          statusLabel: "Sovereign state",
          sovereign: true,
        },
      ],
    });
  }) as typeof fetch;
  try {
    await loadJurisdictionDirectory();
    assert.equal(calls, 1);
    // No further interaction: only the scheduled retry may fetch again.
    mock.timers.tick(1_000);
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    mock.timers.reset();
  }
});
