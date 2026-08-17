import assert from "node:assert/strict";
import test from "node:test";
import { pulseV2IngestCronOutcome } from "../cron-outcomes";
import type { JurisdictionMap } from "../country-resolver";
import { ingestPulseV2, type Db, type PulseIngestOptions } from "../ingest";
import type { RawEventInput } from "../types";
import { createPulsePipelineRunRef } from "../pipeline-version";
import { fetchAcled } from "./acled";
import { fetchIpuActions } from "./ipu-actions";
import { fetchReutersAp } from "./reuters-ap";
import { fetchRsf } from "./rsf";

const map: JurisdictionMap = new Map([
  ["URY", "jurisdiction-uruguay"],
  ["URUGUAY", "jurisdiction-uruguay"],
]);

const successRow: RawEventInput = {
  sourceId: "working_feed",
  externalId: "event-1",
  sourceUrl: "https://example.test/event-1",
  sourceType: "news",
  jurisdictionId: "jurisdiction-uruguay",
  rawCountryName: "Uruguay",
  eventDate: "2026-07-14",
  title: "Fixture event",
  body: null,
  raw: { fixture: true },
};

test("explicitly unconfigured opt-in connectors remain legitimate skips", async () => {
  let fetchCalls = 0;
  const fetchFeed = async () => {
    fetchCalls++;
    return [];
  };

  assert.deepEqual(
    await fetchAcled(map, {
      apiKey: null,
      email: null,
      fetchImpl: (async () => {
        fetchCalls++;
        return new Response();
      }) as typeof fetch,
    }),
    { rows: [], unmatchedCountry: 0, fetched: 0, ran: false },
  );
  assert.deepEqual(await fetchRsf(map, { feedUrl: null, fetchFeed }), {
    rows: [],
    unmatchedCountry: 0,
    fetched: 0,
  });
  assert.deepEqual(
    await fetchReutersAp(map, {
      reutersUrl: null,
      apUrl: null,
      fetchFeed,
    }),
    {
      rows: [],
      unmatchedCountry: 0,
      fetched: 0,
      reutersFetched: 0,
      apFetched: 0,
    },
  );
  assert.equal(fetchCalls, 0);
});

test("configured ACLED surfaces network, non-2xx, and parse failures", async () => {
  const configured = { apiKey: "fixture-key", email: "fixture@example.test" };

  await assert.rejects(
    fetchAcled(map, {
      ...configured,
      fetchImpl: (async () => {
        throw new Error("socket reset");
      }) as typeof fetch,
    }),
    /ACLED request failed: socket reset/,
  );
  await assert.rejects(
    fetchAcled(map, {
      ...configured,
      fetchImpl: (async () =>
        new Response("unavailable", { status: 503 })) as typeof fetch,
    }),
    /ACLED request returned HTTP 503/,
  );
  await assert.rejects(
    fetchAcled(map, {
      ...configured,
      fetchImpl: (async () =>
        new Response("not-json", {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
    }),
    /ACLED response parse failed/,
  );
  await assert.rejects(
    fetchAcled(map, {
      ...configured,
      fetchImpl: (async () =>
        Response.json({ unexpected: [] })) as typeof fetch,
    }),
    /expected a data array/,
  );
});

test("partially configured ACLED rejects without making a request", async () => {
  let fetchCalls = 0;
  const fetchImpl = (async () => {
    fetchCalls++;
    return Response.json({ data: [] });
  }) as typeof fetch;

  await assert.rejects(
    fetchAcled(map, {
      apiKey: "fixture-key",
      email: null,
      fetchImpl,
    }),
    /ACLED configuration incomplete: ACLED_API_EMAIL/,
  );
  await assert.rejects(
    fetchAcled(map, {
      apiKey: null,
      email: "fixture@example.test",
      fetchImpl,
    }),
    /ACLED configuration incomplete: ACLED_API_KEY/,
  );
  assert.equal(fetchCalls, 0);
});

test("configured RSS connectors surface retrieval and parse failures", async () => {
  const parseFailure = async () => {
    throw new Error("invalid RSS document");
  };

  await assert.rejects(
    fetchRsf(map, {
      feedUrl: "https://example.test/rsf.xml",
      fetchFeed: parseFailure,
    }),
    /RSF feed retrieval failed.*invalid RSS document/,
  );
  await assert.rejects(
    fetchReutersAp(map, {
      reutersUrl: "https://example.test/reuters.xml",
      apUrl: null,
      fetchFeed: parseFailure,
    }),
    /reuters_wire feed retrieval failed.*invalid RSS document/,
  );
});

test("an unusable Reuters feed cannot be masked by a usable AP sibling", async () => {
  await assert.rejects(
    fetchReutersAp(map, {
      reutersUrl: "https://example.test/reuters.xml",
      apUrl: "https://example.test/ap.xml",
      fetchFeed: async (url) =>
        url.includes("reuters")
          ? [{ title: "", link: "", raw: { malformed: true } }]
          : [
              {
                title: "Uruguay parliament approves fixture bill",
                link: "https://example.test/ap/fixture",
                raw: { fixture: true },
              },
            ],
    }),
    /reuters_wire feed parsed 1 upstream record but produced no usable event rows/,
  );
});

test("the IPU default endpoint surfaces HTTP and parse failures", async () => {
  let requestedUrl = "";
  await assert.rejects(
    fetchIpuActions(map, {
      fetchImpl: (async (input) => {
        requestedUrl = String(input);
        return new Response("unavailable", { status: 502 });
      }) as typeof fetch,
    }),
    /IPU actions request returned HTTP 502/,
  );
  assert.match(requestedUrl, /^https:\/\/api\.data\.ipu\.org\/v1\/elections\?/);

  await assert.rejects(
    fetchIpuActions(map, {
      fetchImpl: (async () =>
        Response.json({ unexpected: [] })) as typeof fetch,
    }),
    /IPU actions response parse failed.*expected a JSON:API data array/,
  );
});

test("configured connectors accept successful quiet periods with zero rows", async () => {
  const emptyFeed = async () => [];

  const acled = await fetchAcled(map, {
    apiKey: "fixture-key",
    email: "fixture@example.test",
    fetchImpl: (async () => Response.json({ data: [] })) as typeof fetch,
  });
  assert.deepEqual(acled, {
    rows: [],
    unmatchedCountry: 0,
    fetched: 0,
    ran: true,
  });
  assert.deepEqual(
    await fetchIpuActions(map, {
      fetchImpl: (async () => Response.json({ data: [] })) as typeof fetch,
    }),
    { rows: [], unmatchedCountry: 0, fetched: 0 },
  );
  assert.deepEqual(
    await fetchRsf(map, {
      feedUrl: "https://example.test/quiet-rsf.xml",
      fetchFeed: emptyFeed,
    }),
    { rows: [], unmatchedCountry: 0, fetched: 0 },
  );
  assert.deepEqual(
    await fetchReutersAp(map, {
      reutersUrl: "https://example.test/quiet-reuters.xml",
      apUrl: "https://example.test/quiet-ap.xml",
      fetchFeed: emptyFeed,
    }),
    {
      rows: [],
      unmatchedCountry: 0,
      fetched: 0,
      reutersFetched: 0,
      apFetched: 0,
    },
  );
});

test("a configured connector failure cannot be masked by a successful sibling", async () => {
  let publishCalls = 0;
  const writeRows: NonNullable<PulseIngestOptions["writeRows"]> = async () => {
    publishCalls++;
    return {
      inserted: 1,
      skippedDuplicate: 0,
      sourcesStamped: ["working_feed"],
      rowOutcomes: ["inserted"],
    };
  };

  const summary = await ingestPulseV2({} as Db, {
    jobs: [
      {
        source: "working",
        fetcher: async () => ({
          rows: [successRow],
          fetched: 1,
          unmatchedCountry: 0,
        }),
      },
      {
        source: "reuters_ap",
        fetcher: () =>
          fetchReutersAp(map, {
            reutersUrl: "https://example.test/broken-reuters.xml",
            apUrl: null,
            fetchFeed: async () => {
              throw new Error("configured feed unavailable");
            },
          }),
      },
    ],
    jurisdictionMap: map,
    writeRows,
    runRef: createPulsePipelineRunRef("ingest", {
      id: "22222222-2222-4222-8222-222222222222",
      sourceIds: ["working_feed", "reuters_wire"],
    }),
  });

  // The successful sibling publishes, but the failure stays visible: the run
  // is partial, the connector error is recorded, and monitoring sees 502.
  assert.equal(publishCalls, 1);
  assert.equal(summary.totalInserted, 1);
  assert.deepEqual(summary.sourcesStamped, ["working_feed"]);
  assert.match(
    summary.reports.find(({ source }) => source === "reuters_ap")?.error ?? "",
    /configured feed unavailable/,
  );
  assert.deepEqual(pulseV2IngestCronOutcome(summary), {
    ok: false,
    outcome: "partial",
    httpStatus: 502,
    failedConnectors: ["reuters_ap"],
  });
});

test("partial ACLED configuration cannot be masked by a successful sibling", async () => {
  let publishCalls = 0;
  const summary = await ingestPulseV2({} as Db, {
    jobs: [
      {
        source: "working",
        fetcher: async () => ({
          rows: [successRow],
          fetched: 1,
          unmatchedCountry: 0,
        }),
      },
      {
        source: "acled",
        fetcher: () =>
          fetchAcled(map, {
            apiKey: "fixture-key",
            email: null,
            fetchImpl: (async () => {
              throw new Error("must not fetch");
            }) as typeof fetch,
          }),
      },
    ],
    jurisdictionMap: map,
    writeRows: async () => {
      publishCalls++;
      return {
        inserted: 1,
        skippedDuplicate: 0,
        sourcesStamped: ["working_feed"],
        rowOutcomes: ["inserted"],
      };
    },
    runRef: createPulsePipelineRunRef("ingest", {
      id: "33333333-3333-4333-8333-333333333333",
      sourceIds: ["working_feed", "acled"],
    }),
  });

  // The successful sibling publishes; the misconfiguration stays a visible
  // partial-run failure.
  assert.equal(publishCalls, 1);
  assert.match(
    summary.reports.find(({ source }) => source === "acled")?.error ?? "",
    /ACLED configuration incomplete/,
  );
  assert.equal(pulseV2IngestCronOutcome(summary).httpStatus, 502);
});

test("nonempty but structurally unusable connector output cannot be masked by a successful sibling", async () => {
  let publishCalls = 0;
  const summary = await ingestPulseV2({} as Db, {
    jobs: [
      {
        source: "working",
        fetcher: async () => ({
          rows: [successRow],
          fetched: 1,
          unmatchedCountry: 0,
        }),
      },
      {
        source: "schema_drifted",
        fetcher: async () => ({
          rows: [],
          fetched: 3,
          unmatchedCountry: 3,
        }),
      },
    ],
    jurisdictionMap: map,
    writeRows: async () => {
      publishCalls++;
      return {
        inserted: 1,
        skippedDuplicate: 0,
        sourcesStamped: ["working_feed"],
        rowOutcomes: ["inserted"],
      };
    },
    runRef: createPulsePipelineRunRef("ingest", {
      id: "44444444-4444-4444-8444-444444444444",
      sourceIds: ["working_feed", "schema_drifted"],
    }),
  });

  // The drifted connector is a recorded failure; the sibling still publishes.
  assert.equal(publishCalls, 1);
  assert.equal(summary.totalFetched, 4);
  assert.equal(summary.totalInserted, 1);
  const failure = summary.reports.find(
    ({ source }) => source === "schema_drifted",
  );
  assert.equal(failure?.fetched, 3);
  assert.match(failure?.error ?? "", /produced no usable event rows/);
  assert.deepEqual(pulseV2IngestCronOutcome(summary), {
    ok: false,
    outcome: "partial",
    httpStatus: 502,
    failedConnectors: ["schema_drifted"],
  });
});
