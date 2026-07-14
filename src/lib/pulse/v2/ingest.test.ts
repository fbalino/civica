import assert from "node:assert/strict";
import test from "node:test";
import type { RawEventInput } from "./types";
import {
  connectorReportsToRunCounts,
  ingestPulseV2,
  pulseConnectorMetricKey,
  type Db,
  type PulseConnectorJob,
  type PulseIngestOptions,
} from "./ingest";
import type { UpsertResult } from "./upsert";
import { createPulsePipelineRunRef } from "./pipeline-version";

test("connector run metrics distinguish success, empty yield, and failure", () => {
  const counts = connectorReportsToRunCounts([
    {
      source: "gdelt",
      fetched: 12,
      wouldWrite: 10,
      inserted: 4,
      skippedDuplicate: 6,
      unmatchedCountry: 2,
    },
    {
      source: "rsf",
      fetched: 0,
      wouldWrite: 0,
      inserted: 0,
      skippedDuplicate: 0,
      unmatchedCountry: 0,
      error: "upstream unavailable",
    },
  ]);
  assert.equal(counts[pulseConnectorMetricKey("gdelt", "failed")], 0);
  assert.equal(counts[pulseConnectorMetricKey("gdelt", "wouldWrite")], 10);
  assert.equal(counts[pulseConnectorMetricKey("rsf", "failed")], 1);
  assert.equal(
    connectorReportsToRunCounts([
      {
        source: "empty-error",
        fetched: 0,
        wouldWrite: 0,
        inserted: 0,
        skippedDuplicate: 0,
        unmatchedCountry: 0,
        error: "",
      },
    ])[pulseConnectorMetricKey("empty-error", "failed")],
    1,
  );
  assert.throws(
    () => pulseConnectorMetricKey("not/a/connector", "fetched"),
    /Invalid Pulse connector id/,
  );
});

const runRef = createPulsePipelineRunRef("ingest", {
  id: "11111111-1111-4111-8111-111111111111",
  sourceIds: ["gdelt"],
});

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

function aggregatePublishHarness() {
  const state = new Map<string, RawEventInput>();
  const stampedBatches: string[][] = [];
  let publishCalls = 0;
  const writeRows: NonNullable<PulseIngestOptions["writeRows"]> = async (
    _db,
    rows,
  ) => {
    publishCalls++;
    const rowOutcomes = rows.map((candidate) => {
      const key = `${candidate.sourceId}:${candidate.externalId}`;
      if (state.has(key)) return "duplicate" as const;
      state.set(key, structuredClone(candidate));
      return "inserted" as const;
    });
    const sourcesStamped = Array.from(
      new Set(
        rows
          .filter((_, index) => rowOutcomes[index] === "inserted")
          .map(({ sourceId }) => sourceId),
      ),
    );
    stampedBatches.push(sourcesStamped);
    return {
      inserted: rowOutcomes.filter((outcome) => outcome === "inserted").length,
      skippedDuplicate: rowOutcomes.filter((outcome) => outcome === "duplicate")
        .length,
      sourcesStamped,
      rowOutcomes,
    };
  };
  return {
    db: {} as Db,
    writeRows,
    state,
    publishCalls: () => publishCalls,
    stampedBatches,
  };
}

test("dry-run returns a stable diff and performs zero writes", async () => {
  let writeCalls = 0;
  const writeRows = async (): Promise<UpsertResult> => {
    writeCalls++;
    return {
      inserted: 1,
      skippedDuplicate: 0,
      sourcesStamped: ["gdelt"],
      rowOutcomes: ["inserted"],
    };
  };
  const options = {
    dryRun: true,
    jobs: jobs(),
    jurisdictionMap: new Map<string, string>(),
    writeRows,
    runRef,
  };
  const first = await ingestPulseV2({} as Db, options);
  const second = await ingestPulseV2({} as Db, options);
  assert.deepEqual(first, second);
  assert.equal(first.totalWouldWrite, 1);
  assert.equal(first.totalInserted, 0);
  assert.deepEqual(first.sourcesStamped, []);
  assert.equal(writeCalls, 0);
});

test("aggregate ingest fetches every connector before one successful publish", async () => {
  const harness = aggregatePublishHarness();
  let fetchedConnectors = 0;
  const secondRow = {
    ...row,
    sourceId: "rsf",
    externalId: "fixture-2",
    sourceUrl: "https://example.test/fixture-2",
  };
  const summary = await ingestPulseV2(harness.db, {
    jobs: [
      {
        source: "gdelt",
        fetcher: async () => {
          fetchedConnectors++;
          return { rows: [row], fetched: 1, unmatchedCountry: 0 };
        },
      },
      {
        source: "rsf",
        fetcher: async () => {
          fetchedConnectors++;
          return {
            rows: [secondRow],
            fetched: 1,
            unmatchedCountry: 0,
          };
        },
      },
    ],
    jurisdictionMap: new Map<string, string>(),
    writeRows: harness.writeRows,
    runRef,
  });

  assert.deepEqual(summary.sourcesStamped.toSorted(), ["gdelt", "rsf"]);
  assert.equal(fetchedConnectors, 2);
  assert.equal(harness.publishCalls(), 1);
  assert.equal(harness.state.size, 2);
  assert.deepEqual(harness.stampedBatches, [["gdelt", "rsf"]]);
});

test("a connector failure writes nothing and the full successful retry stamps every inserted source", async () => {
  const harness = aggregatePublishHarness();
  let rsfFails = true;
  const connectorJobs = (): PulseConnectorJob[] => [
    {
      source: "gdelt",
      fetcher: async () => ({ rows: [row], fetched: 1, unmatchedCountry: 0 }),
    },
    {
      source: "rsf",
      fetcher: async () => {
        if (rsfFails) {
          // Even an empty message is an aggregate failure; truthiness must not
          // control whether the successful connector subset is published.
          throw new Error("");
        }
        return {
          rows: [
            {
              ...row,
              sourceId: "rsf",
              externalId: "fixture-rsf",
              sourceUrl: "https://example.test/fixture-rsf",
            },
          ],
          fetched: 1,
          unmatchedCountry: 0,
        };
      },
    },
  ];

  const partial = await ingestPulseV2(harness.db, {
    jobs: connectorJobs(),
    jurisdictionMap: new Map<string, string>(),
    writeRows: harness.writeRows,
    runRef,
  });

  assert.equal(partial.totalInserted, 0);
  assert.equal(
    partial.reports.find(({ source }) => source === "rsf")?.error,
    "",
  );
  assert.deepEqual(partial.sourcesStamped, []);
  assert.equal(harness.publishCalls(), 0);
  assert.equal(harness.state.size, 0);

  rsfFails = false;
  const retried = await ingestPulseV2(harness.db, {
    jobs: connectorJobs(),
    jurisdictionMap: new Map<string, string>(),
    writeRows: harness.writeRows,
    runRef,
  });

  assert.equal(retried.totalInserted, 2);
  assert.equal(harness.publishCalls(), 1);
  assert.equal(harness.state.size, 2);
  assert.deepEqual(retried.sourcesStamped.toSorted(), ["gdelt", "rsf"]);
  assert.deepEqual(harness.stampedBatches, [["gdelt", "rsf"]]);
});

test("strict connector failures still await every fetch and publish nothing", async () => {
  const harness = aggregatePublishHarness();
  let completedFetches = 0;
  await assert.rejects(
    ingestPulseV2(harness.db, {
      jobs: [
        {
          source: "gdelt",
          fetcher: async () => {
            completedFetches++;
            return { rows: [row], fetched: 1, unmatchedCountry: 0 };
          },
        },
        {
          source: "broken",
          fetcher: async () => {
            completedFetches++;
            throw new Error("malformed fixture");
          },
        },
      ],
      jurisdictionMap: new Map<string, string>(),
      writeRows: harness.writeRows,
      runRef,
      failOnConnectorError: true,
    }),
    /broken failed: malformed fixture/,
  );
  assert.equal(completedFetches, 2);
  assert.equal(harness.publishCalls(), 0);
});

test("two fixture applications preserve identical canonical state without duplicates", async () => {
  const state = new Map<string, RawEventInput>();
  const writeRows = async (
    _db: Db,
    rows: RawEventInput[],
  ): Promise<UpsertResult> => {
    let inserted = 0;
    let skippedDuplicate = 0;
    const rowOutcomes: UpsertResult["rowOutcomes"] = [];
    for (const candidate of rows) {
      const key = `${candidate.sourceId}:${candidate.externalId}`;
      if (state.has(key)) {
        skippedDuplicate++;
        rowOutcomes.push("duplicate");
      } else {
        state.set(key, structuredClone(candidate));
        inserted++;
        rowOutcomes.push("inserted");
      }
    }
    return {
      inserted,
      skippedDuplicate,
      sourcesStamped: inserted ? ["gdelt"] : [],
      rowOutcomes,
    };
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
      jobs: [
        {
          source: "broken",
          fetcher: async () => {
            throw new Error("malformed fixture");
          },
        },
      ],
      jurisdictionMap: new Map<string, string>(),
      failOnConnectorError: true,
    }),
    /broken failed: malformed fixture/,
  );
});

test("strict fixture mode rejects a completely empty upstream result", async () => {
  await assert.rejects(
    ingestPulseV2({} as Db, {
      jobs: [
        {
          source: "empty",
          fetcher: async () => ({ rows: [], fetched: 0, unmatchedCountry: 0 }),
        },
      ],
      jurisdictionMap: new Map<string, string>(),
      requireNonEmpty: true,
    }),
    /returned no usable rows/,
  );
});

test("strict fixture mode rejects fetched rows when none are usable", async () => {
  let writeCalls = 0;
  await assert.rejects(
    ingestPulseV2({} as Db, {
      jobs: [
        {
          source: "all-unmatched",
          fetcher: async () => ({
            rows: [],
            fetched: 4,
            unmatchedCountry: 4,
          }),
        },
      ],
      jurisdictionMap: new Map<string, string>(),
      requireNonEmpty: true,
      failOnConnectorError: true,
      writeRows: async () => {
        writeCalls++;
        return {
          inserted: 0,
          skippedDuplicate: 0,
          sourcesStamped: [],
          rowOutcomes: [],
        };
      },
    }),
    /all-unmatched failed: Fetched 4 upstream records but produced no usable event rows/,
  );
  assert.equal(writeCalls, 0);
});
