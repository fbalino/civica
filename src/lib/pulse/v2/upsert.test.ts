import assert from "node:assert/strict";
import test from "node:test";
import type { RawEventInput } from "./types";
import { rawEventInputErrors, upsertRawEvents } from "./upsert";

const fixture: RawEventInput = {
  sourceId: "gdelt",
  externalId: "fixture-1",
  sourceUrl: "https://example.test/fixture-1",
  sourceType: "news",
  eventDate: "2026-07-10",
  title: "Fixture event",
  raw: { fixture: true },
};
const ingestRunId = "11111111-1111-4111-8111-111111111111";

function fakeDb() {
  const state: Array<Record<string, unknown>> = [];
  const outcomes: Array<Record<string, unknown>> = [];
  let freshnessUpdates = 0;
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (state.length ? [{ id: "existing", evidenceIdentityKey: state[0].evidenceIdentityKey }] : []),
        }),
      }),
    }),
    insert: () => ({
      values: (value: Record<string, unknown> | Array<Record<string, unknown>>) => {
        if (Array.isArray(value)) {
          outcomes.push(...value);
          return { onConflictDoNothing: async () => undefined };
        }
        state.push(value);
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: () => ({
        where: async () => {
          freshnessUpdates++;
        },
      }),
    }),
  };
  return { db, state, outcomes, freshnessUpdates: () => freshnessUpdates };
}

test("the real Pulse upsert is idempotent and duplicate reruns do not stamp freshness", async () => {
  const harness = fakeDb();
  const first = await upsertRawEvents(
    harness.db as never,
    [fixture],
    ingestRunId,
  );
  const afterFirst = structuredClone(harness.state);
  const second = await upsertRawEvents(
    harness.db as never,
    [fixture],
    ingestRunId,
  );
  assert.deepEqual(harness.state, afterFirst);
  assert.equal(harness.state.length, 1);
  assert.equal(harness.outcomes.length, 1);
  assert.equal(harness.outcomes[0].outcome, "duplicate");
  assert.equal(harness.outcomes[0].reasonCode, "source_external_id_duplicate");
  assert.deepEqual(first, {
    inserted: 1,
    skippedDuplicate: 0,
    sourcesStamped: ["gdelt"],
  });
  assert.deepEqual(second, {
    inserted: 0,
    skippedDuplicate: 1,
    sourcesStamped: [],
  });
  assert.equal(harness.freshnessUpdates(), 1);
});

test("empty input is a no-op and cannot stamp freshness", async () => {
  const harness = fakeDb();
  assert.deepEqual(
    await upsertRawEvents(harness.db as never, [], ingestRunId),
    {
      inserted: 0,
      skippedDuplicate: 0,
      sourcesStamped: [],
    },
  );
  assert.equal(harness.freshnessUpdates(), 0);
});

test("malformed rows fail before any database write or freshness update", async () => {
  const harness = fakeDb();
  const malformed = { ...fixture, externalId: null, sourceUrl: null };
  assert.match(rawEventInputErrors(malformed).join(" "), /evidence identity/);
  await assert.rejects(
    upsertRawEvents(harness.db as never, [malformed], ingestRunId),
    /sourceUrl is required/,
  );
  assert.equal(harness.state.length, 0);
  assert.equal(harness.freshnessUpdates(), 0);
});
