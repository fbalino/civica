import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { pulseV2IngestCronOutcome } from "./cron-outcomes";
import type { JurisdictionMap } from "./country-resolver";
import {
  ingestPulseV2,
  PULSE_MAC_RETRIEVED_CONNECTORS,
  pulseConnectorMetricKey,
  selectPulseConnectorJobs,
  type Db,
  type PulseConnectorJob,
  type PulseIngestOptions,
} from "./ingest";
import { createPulsePipelineRunRef } from "./pipeline-version";
import type { PulseConnectorFact } from "./runtime-contract";
import { buildPulseSourceCoverageReport } from "./source-coverage";
import type { RawEventInput } from "./types";

const map: JurisdictionMap = new Map([["URUGUAY", "jurisdiction-uruguay"]]);

const row = (sourceId: string): RawEventInput => ({
  sourceId,
  externalId: `${sourceId}-1`,
  sourceUrl: `https://example.test/${sourceId}`,
  sourceType: "news",
  jurisdictionId: "jurisdiction-uruguay",
  rawCountryName: "Uruguay",
  eventDate: "2026-09-29",
  title: "Fixture event",
  body: null,
  raw: { fixture: true },
});

function fixtureJobs(called: string[]): PulseConnectorJob[] {
  return ["gdelt", "hrw"].map((source) => ({
    source,
    fetcher: async () => {
      called.push(source);
      if (source === "gdelt") throw new Error("connect timeout");
      return { rows: [row(source)], fetched: 1, unmatchedCountry: 0 };
    },
  }));
}

const writeRows: NonNullable<PulseIngestOptions["writeRows"]> = async (
  _db,
  rows,
) => ({
  inserted: rows.length,
  skippedDuplicate: 0,
  sourcesStamped: [...new Set(rows.map((item) => item.sourceId))].sort(),
  rowOutcomes: rows.map(() => "inserted" as const),
});

test("connector selection keeps, skips, and rejects named connectors", () => {
  const jobs = [{ source: "gdelt" }, { source: "hrw" }, { source: "ipu" }];
  assert.deepEqual(
    selectPulseConnectorJobs(jobs, {}).map(({ source }) => source),
    ["gdelt", "hrw", "ipu"],
  );
  assert.deepEqual(
    selectPulseConnectorJobs(jobs, { onlyConnectors: ["gdelt"] }).map(
      ({ source }) => source,
    ),
    ["gdelt"],
  );
  assert.deepEqual(
    selectPulseConnectorJobs(jobs, { skipConnectors: ["gdelt"] }).map(
      ({ source }) => source,
    ),
    ["hrw", "ipu"],
  );
  assert.throws(
    () => selectPulseConnectorJobs(jobs, { onlyConnectors: ["gdlet"] }),
    /Unknown Pulse connector: gdlet/,
  );
  assert.throws(
    () =>
      selectPulseConnectorJobs(jobs, {
        onlyConnectors: ["gdelt"],
        skipConnectors: ["hrw"],
      }),
    /either onlyConnectors or skipConnectors/,
  );
  assert.throws(
    () =>
      selectPulseConnectorJobs(jobs, {
        skipConnectors: ["gdelt", "hrw", "ipu"],
      }),
    /No Pulse connector selected/,
  );
});

test("an ingest that skips GDELT never calls it and finishes complete", async () => {
  const called: string[] = [];
  const summary = await ingestPulseV2({} as Db, {
    jobs: fixtureJobs(called),
    jurisdictionMap: map,
    writeRows,
    skipConnectors: PULSE_MAC_RETRIEVED_CONNECTORS,
    runRef: createPulsePipelineRunRef("ingest", {
      id: "33333333-3333-4333-8333-333333333333",
      sourceIds: ["hrw"],
    }),
  });
  assert.deepEqual(called, ["hrw"]);
  assert.deepEqual(
    summary.reports.map(({ source }) => source),
    ["hrw"],
  );
  assert.deepEqual(summary.sourcesStamped, ["hrw"]);
  assert.equal(pulseV2IngestCronOutcome(summary).outcome, "completed");
});

test("an unknown connector fails before any retrieval or write", async () => {
  const called: string[] = [];
  let writes = 0;
  await assert.rejects(
    ingestPulseV2({} as Db, {
      jobs: fixtureJobs(called),
      jurisdictionMap: map,
      writeRows: async (...args) => {
        writes++;
        return writeRows(...args);
      },
      onlyConnectors: ["gdlet"],
    }),
    /Unknown Pulse connector: gdlet/,
  );
  assert.deepEqual(called, []);
  assert.equal(writes, 0);
});

test("the scheduled route skips every Mac-retrieved connector", () => {
  assert.deepEqual([...PULSE_MAC_RETRIEVED_CONNECTORS], ["gdelt"]);
  const route = readFileSync("src/app/api/cron/pulse/v2/ingest/route.ts", "utf8");
  assert.match(route, /skipConnectors: PULSE_MAC_RETRIEVED_CONNECTORS/);
  const runner = readFileSync("scripts/pulse/mac-daily-runner.sh", "utf8");
  assert.match(runner, /sync-pulse-v2-ingest\.ts --connectors=gdelt/);
});

test("feed state follows the runs that retrieved the feed", () => {
  const gdelt: PulseConnectorFact = {
    feedId: "gdelt",
    connectorId: "gdelt",
    sourceIds: ["gdelt"],
    role: "news",
    status: "active_observed",
    defaultEnabled: true,
    observedInProduction: true,
    activation: "fixture",
    blindSpots: ["fixture limitation"],
  };
  const report = buildPulseSourceCoverageReport({
    generatedAt: "2026-10-01T09:00:00.000Z",
    connectors: [gdelt],
    runs: [
      // The newer Vercel run skipped GDELT and carries no GDELT counters.
      {
        id: "vercel",
        status: "completed",
        startedAt: "2026-10-01T08:00:00.000Z",
        completedAt: "2026-10-01T08:01:00.000Z",
        counts: { [pulseConnectorMetricKey("hrw", "failed")]: 0 },
      },
      {
        id: "mac",
        status: "completed",
        startedAt: "2026-09-30T13:31:30.000Z",
        completedAt: "2026-09-30T13:33:00.000Z",
        counts: {
          [pulseConnectorMetricKey("gdelt", "failed")]: 0,
          [pulseConnectorMetricKey("gdelt", "inserted")]: 40,
        },
      },
    ].sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
    evidence: [
      {
        sourceId: "gdelt",
        retainedRows: 40,
        lastDataAt: "2026-09-30T13:32:00.000Z",
        languages: ["en"],
        jurisdictionIso3s: ["URY"],
        unresolvedJurisdictionRows: 0,
      },
    ],
  });
  assert.equal(report.feeds[0].state, "operating");
  assert.equal(report.feeds[0].retrieval.observedRuns, 1);
});
