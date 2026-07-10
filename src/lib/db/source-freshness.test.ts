import assert from "node:assert/strict";
import test from "node:test";
import { markSourcesSynced, type SourceFreshnessExecutor } from "./source-freshness";

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
