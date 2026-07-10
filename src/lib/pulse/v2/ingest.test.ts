import assert from "node:assert/strict";
import test from "node:test";
import type { RawEventInput } from "./types";
import {
  ingestPulseV2,
  type Db,
  type PulseConnectorJob,
} from "./ingest";
import type { UpsertResult } from "./upsert";

const row: RawEventInput = {
  sourceId: "gdelt",
  externalId: "fixture-1",
  sourceUrl: "https://example.test/fixture-1",
  sourceType: "news",
  jurisdictionId: "jurisdiction-1",
  rawCountryName: "Example",
  eventDate: "2026-07-10",
  title: "Fixture governance event",
  body: "Fixture body",
  raw: { fixture: true },
};

const jobs = (): PulseConnectorJob[] => [
  {
    source: "fixture-b",
    fetcher: async () => ({ rows: [row], fetched: 1, unmatchedCountry: 0 }),
  },
  {
    source: "fixture-a",
    fetcher: async () => ({ rows: [], fetched: 0, unmatchedCountry: 0 }),
  },
];

test("dry-run returns a stable diff and performs zero writes", async () => {
  let writeCalls = 0;
  const writeRows = async (): Promise<UpsertResult> => {
    writeCalls++;
    return { inserted: 1, skippedDuplicate: 0, sourcesStamped: ["gdelt"] };
  };
  const options = {
    dryRun: true,
    jobs: jobs(),
    jurisdictionMap: new Map<string, string>(),
    writeRows,
  };
  const first = await ingestPulseV2({} as Db, options);
  const second = await ingestPulseV2({} as Db, options);
  assert.deepEqual(first, second);
  assert.equal(first.totalWouldWrite, 1);
  assert.equal(first.totalInserted, 0);
  assert.equal(writeCalls, 0);
});

test("two fixture applications preserve identical canonical state without duplicates", async () => {
  const state = new Map<string, RawEventInput>();
  const writeRows = async (_db: Db, rows: RawEventInput[]): Promise<UpsertResult> => {
    let inserted = 0;
    let skippedDuplicate = 0;
    for (const candidate of rows) {
      const key = `${candidate.sourceId}:${candidate.externalId}`;
      if (state.has(key)) skippedDuplicate++;
      else {
        state.set(key, structuredClone(candidate));
        inserted++;
      }
    }
    return { inserted, skippedDuplicate, sourcesStamped: inserted ? ["gdelt"] : [] };
  };
  const options = {
    jobs: jobs(),
    jurisdictionMap: new Map<string, string>(),
    writeRows,
  };
  const first = await ingestPulseV2({} as Db, options);
  const afterFirst = structuredClone([...state.entries()]);
  const second = await ingestPulseV2({} as Db, options);
  assert.deepEqual([...state.entries()], afterFirst);
  assert.equal(state.size, 1);
  assert.equal(first.totalInserted, 1);
  assert.equal(second.totalInserted, 0);
  assert.equal(second.totalSkipped, 1);
});

test("strict fixture mode fails loudly on malformed connector output", async () => {
  await assert.rejects(
    ingestPulseV2({} as Db, {
      jobs: [{ source: "broken", fetcher: async () => { throw new Error("malformed fixture"); } }],
      jurisdictionMap: new Map<string, string>(),
      failOnConnectorError: true,
    }),
    /broken failed: malformed fixture/,
  );
});

test("strict fixture mode rejects a completely empty upstream result", async () => {
  await assert.rejects(
    ingestPulseV2({} as Db, {
      jobs: [{ source: "empty", fetcher: async () => ({ rows: [], fetched: 0, unmatchedCountry: 0 }) }],
      jurisdictionMap: new Map<string, string>(),
      requireNonEmpty: true,
    }),
    /returned no rows/,
  );
});
