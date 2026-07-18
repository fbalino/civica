import assert from "node:assert/strict";
import test from "node:test";

import {
  atlasSurfaceQueryValue,
  captureAtlasSurfaceQuery,
} from "./surface-query-state";

test("an Atlas reader query retains a fulfilled empty result", async () => {
  const state = await captureAtlasSurfaceQuery(async () => [] as string[]);

  assert.deepEqual(state, { status: "available", value: [] });
  assert.deepEqual(atlasSurfaceQueryValue(state), []);
});

test("an Atlas reader query never converts a rejection into an empty result", async () => {
  const state = await captureAtlasSurfaceQuery<string[]>(async () => {
    throw new Error("database unavailable");
  });

  assert.deepEqual(state, { status: "unavailable" });
  assert.equal(atlasSurfaceQueryValue(state), null);
});

test("a caller can preserve a release-consistency failure", async () => {
  const consistencyError = new Error("release mismatch");

  await assert.rejects(
    captureAtlasSurfaceQuery(
      async () => {
        throw consistencyError;
      },
      { rethrow: (error) => error === consistencyError },
    ),
    consistencyError,
  );
});
