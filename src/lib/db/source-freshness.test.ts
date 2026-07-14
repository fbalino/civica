import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeferredSourceFreshness,
  markSourcesSynced,
  type SourceFreshnessExecutor,
} from "./source-freshness";

type FakeState = {
  updates: number;
  values: unknown[];
  wheres: unknown[];
  fail?: Error;
};

function fakeExecutor(state: FakeState): SourceFreshnessExecutor {
  return {
    update() {
      state.updates++;
      return {
        set(value: unknown) {
          state.values.push(value);
          return {
            async where(value: unknown) {
              state.wheres.push(value);
              if (state.fail) throw state.fail;
              return [];
            },
          };
        },
      };
    },
  } as unknown as SourceFreshnessExecutor;
}

test("dry runs never execute a freshness update", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  const stamped = await markSourcesSynced("world_bank", {
    rowsWritten: 12,
    dryRun: true,
    executor: fakeExecutor(state),
  });
  assert.deepEqual(stamped, []);
  assert.equal(state.updates, 0);
});

for (const rowsWritten of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
  test(`invalid or empty row count ${rowsWritten} fails closed`, async () => {
    const state: FakeState = { updates: 0, values: [], wheres: [] };
    const stamped = await markSourcesSynced("world_bank", {
      rowsWritten,
      executor: fakeExecutor(state),
    });
    assert.deepEqual(stamped, []);
    assert.equal(state.updates, 0);
  });
}

test("empty source IDs never execute a freshness update", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  assert.deepEqual(
    await markSourcesSynced(["", "  "], {
      rowsWritten: 1,
      executor: fakeExecutor(state),
    }),
    [],
  );
  assert.equal(state.updates, 0);
});

test("a successful row-writing run stamps the exact source and timestamp once", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  const at = new Date("2026-07-10T12:00:00.000Z");
  const stamped = await markSourcesSynced("world_bank", {
    rowsWritten: 4,
    at,
    executor: fakeExecutor(state),
  });
  assert.deepEqual(stamped, ["world_bank"]);
  assert.equal(state.updates, 1);
  assert.deepEqual(state.values, [{ lastSyncAt: at }]);
  assert.equal(state.wheres.length, 1);
});

test("multi-source success trims, de-duplicates, and stamps in one statement", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  const stamped = await markSourcesSynced(
    ["camara_br", "senado_br", "camara_br", " senado_br "],
    { rowsWritten: 8, executor: fakeExecutor(state) },
  );
  assert.deepEqual(stamped, ["camara_br", "senado_br"]);
  assert.equal(state.updates, 1);
  assert.equal(state.wheres.length, 1);
});

test("an invalid timestamp fails before any update", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  await assert.rejects(
    markSourcesSynced("world_bank", {
      rowsWritten: 1,
      at: new Date("invalid"),
      executor: fakeExecutor(state),
    }),
    /invalid timestamp/,
  );
  assert.equal(state.updates, 0);
});

test("an executor failure rejects and never reports a stamped source", async () => {
  const state: FakeState = {
    updates: 0,
    values: [],
    wheres: [],
    fail: new Error("database unavailable"),
  };
  let reported: string[] | null = null;
  await assert.rejects(async () => {
    reported = await markSourcesSynced("world_bank", {
      rowsWritten: 1,
      executor: fakeExecutor(state),
    });
  }, /database unavailable/);
  assert.equal(reported, null);
  assert.equal(state.updates, 1);
});

test("deferred freshness captures without stamping and flushes only when explicitly called", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  const at = new Date("2026-07-14T12:00:00.000Z");
  const freshness = createDeferredSourceFreshness();

  assert.deepEqual(
    await freshness.capture("world_bank", { rowsWritten: 4 }),
    [],
  );
  assert.equal(state.updates, 0);

  assert.deepEqual(
    await freshness.flush({ at, executor: fakeExecutor(state) }),
    ["world_bank"],
  );
  assert.equal(state.updates, 1);
  assert.deepEqual(state.values, [{ lastSyncAt: at }]);
});

test("deferred freshness ignores dry, empty, invalid-count, and blank-id captures", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  const freshness = createDeferredSourceFreshness();

  await freshness.capture("world_bank", { rowsWritten: 12, dryRun: true });
  await freshness.capture("world_bank", { rowsWritten: 0 });
  await freshness.capture("world_bank", { rowsWritten: -1 });
  await freshness.capture("world_bank", { rowsWritten: Number.NaN });
  await freshness.capture("world_bank", {
    rowsWritten: Number.POSITIVE_INFINITY,
  });
  await freshness.capture("world_bank", { rowsWritten: 1.5 });
  await freshness.capture(["", "  "], { rowsWritten: 3 });

  assert.deepEqual(
    await freshness.flush({ executor: fakeExecutor(state) }),
    [],
  );
  assert.equal(state.updates, 0);
});

test("deferred freshness aggregates rows and de-duplicates ids in first-seen order", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  const freshness = createDeferredSourceFreshness();

  await freshness.capture([" camara_br ", "senado_br", "camara_br", ""], {
    rowsWritten: 4,
  });
  await freshness.capture(["senado_br", "world_bank"], { rowsWritten: 6 });

  assert.deepEqual(await freshness.flush({ executor: fakeExecutor(state) }), [
    "camara_br",
    "senado_br",
    "world_bank",
  ]);
  assert.equal(state.updates, 1);
  assert.equal(state.wheres.length, 1);
});

test("deferred freshness sums to the safe-integer boundary and rejects overflow atomically", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  const freshness = createDeferredSourceFreshness();

  await freshness.capture(["world_bank", "world_bank"], {
    rowsWritten: Number.MAX_SAFE_INTEGER,
  });
  assert.throws(
    () => freshness.capture("must_not_be_added", { rowsWritten: 1 }),
    /exceeds Number\.MAX_SAFE_INTEGER/,
  );

  assert.deepEqual(await freshness.flush({ executor: fakeExecutor(state) }), [
    "world_bank",
  ]);
  assert.equal(state.updates, 1);
});

test("deferred freshness shares one flush promise across concurrent and repeated callers", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  const freshness = createDeferredSourceFreshness();
  await freshness.capture("world_bank", { rowsWritten: 2 });

  const first = freshness.flush({ executor: fakeExecutor(state) });
  const second = freshness.flush({
    at: new Date("2040-01-01T00:00:00.000Z"),
    executor: fakeExecutor(state),
  });

  assert.strictEqual(second, first);
  assert.deepEqual(await first, ["world_bank"]);
  assert.deepEqual(await freshness.flush(), ["world_bank"]);
  assert.equal(state.updates, 1);
});

test("deferred freshness caches executor failures instead of issuing a second stamp", async () => {
  const state: FakeState = {
    updates: 0,
    values: [],
    wheres: [],
    fail: new Error("database unavailable"),
  };
  const freshness = createDeferredSourceFreshness();
  await freshness.capture("world_bank", { rowsWritten: 2 });

  const first = freshness.flush({ executor: fakeExecutor(state) });
  const second = freshness.flush({ executor: fakeExecutor(state) });
  assert.strictEqual(second, first);
  await assert.rejects(first, /database unavailable/);
  await assert.rejects(second, /database unavailable/);
  assert.equal(state.updates, 1);
});

test("deferred freshness rejects captures after flushing starts, including an empty flush", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  const freshness = createDeferredSourceFreshness();
  const flushed = freshness.flush({ executor: fakeExecutor(state) });

  assert.throws(
    () => freshness.capture("world_bank", { rowsWritten: 1 }),
    /after flush has started/,
  );
  assert.deepEqual(await flushed, []);
  assert.equal(state.updates, 0);
});

test("deferred freshness delegates timestamp validation to the sanctioned helper", async () => {
  const state: FakeState = { updates: 0, values: [], wheres: [] };
  const freshness = createDeferredSourceFreshness();
  await freshness.capture("world_bank", { rowsWritten: 1 });

  await assert.rejects(
    freshness.flush({
      at: new Date("invalid"),
      executor: fakeExecutor(state),
    }),
    /invalid timestamp/,
  );
  assert.equal(state.updates, 0);
});
