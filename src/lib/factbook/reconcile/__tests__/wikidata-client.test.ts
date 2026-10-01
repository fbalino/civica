import assert from "node:assert/strict";
import test from "node:test";

import {
  getClaimsForEntityBatch,
  runSparql,
  type SparqlBinding,
} from "../wikidata-client";

function binding(
  values: Record<string, string | undefined>,
): SparqlBinding {
  return Object.fromEntries(
    Object.entries(values)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([key, value]) => [key, { type: "uri" as const, value }]),
  );
}

test("Wikidata deadline prevents a retry after the remaining budget is spent", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (_input, init) => {
    calls++;
    return await new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      assert.ok(signal);
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      runSparql("SELECT * WHERE {}", {
        attemptTimeoutMs: 5,
        retryDelayMs: 1000,
        deadlineAtMs: Date.now() + 5,
      }),
      /acquisition deadline exceeded/,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("one Wikidata batch keeps properties, references, and time precision isolated", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input) => {
    requestedUrls.push(String(input));
    return new Response(JSON.stringify({
      head: { vars: [] },
      results: {
        bindings: [
          binding({
            property: "http://www.wikidata.org/entity/P1082",
            stmt: "http://www.wikidata.org/entity/statement/Q30-population",
            value: "341814420",
            unit: "http://www.wikidata.org/entity/Q199",
            pit: "2025-01-01T00:00:00Z",
            pitPrecision: "9",
            rank: "http://wikiba.se/ontology#PreferredRank",
            refStatedIn: "http://www.wikidata.org/entity/Q21540096",
            refStatedInLabel: "World Bank",
            refUrl: "https://data.worldbank.org/indicator/SP.POP.TOTL",
          }),
          binding({
            property: "http://www.wikidata.org/entity/P1082",
            stmt: "http://www.wikidata.org/entity/statement/Q30-population",
            value: "341814420",
            unit: "http://www.wikidata.org/entity/Q199",
            pit: "2025-01-01T00:00:00Z",
            pitPrecision: "9",
            rank: "http://wikiba.se/ontology#PreferredRank",
            refPublisher: "http://www.wikidata.org/entity/Q193563",
            refPublisherLabel: "United Nations",
            refUrl: "https://population.un.org/",
          }),
          binding({
            property: "http://www.wikidata.org/entity/P2131",
            stmt: "http://www.wikidata.org/entity/statement/Q30-gdp",
            value: "29100000000000",
            unit: "http://www.wikidata.org/entity/Q4917",
            startTime: "2024-06-01T00:00:00Z",
            startPrecision: "10",
            rank: "http://wikiba.se/ontology#NormalRank",
            refStatedIn: "http://www.wikidata.org/entity/Q21540096",
            refStatedInLabel: "World Bank",
          }),
        ],
      },
    }), { status: 200 });
  }) as typeof fetch;

  try {
    const claims = await getClaimsForEntityBatch("Q30", [
      "P1082",
      "P2131",
      "P999999",
    ]);

    assert.equal(requestedUrls.length, 1);
    const query = new URL(requestedUrls[0]!).searchParams.get("query") ?? "";
    assert.match(query, /\(wd:P1082 p:P1082 ps:P1082 psv:P1082\)/);
    assert.match(query, /\(wd:P2131 p:P2131 ps:P2131 psv:P2131\)/);
    assert.deepEqual(claims.P999999, []);
    assert.deepEqual(claims.P1082, [
      {
        statementIri: "http://www.wikidata.org/entity/statement/Q30-population",
        valueRaw: "341814420",
        valueUnitQid: "Q199",
        pointInTime: "2025-01-01T00:00:00Z",
        pointInTimePrecision: 9,
        rank: "preferred",
        refStatedInQid: "Q21540096",
        refStatedInLabel: "World Bank",
        refUrl: "https://data.worldbank.org/indicator/SP.POP.TOTL",
      },
      {
        statementIri: "http://www.wikidata.org/entity/statement/Q30-population",
        valueRaw: "341814420",
        valueUnitQid: "Q199",
        pointInTime: "2025-01-01T00:00:00Z",
        pointInTimePrecision: 9,
        rank: "preferred",
        refStatedInQid: "Q193563",
        refStatedInLabel: "United Nations",
        refUrl: "https://population.un.org/",
      },
    ]);
    assert.deepEqual(claims.P2131, [
      {
        statementIri: "http://www.wikidata.org/entity/statement/Q30-gdp",
        valueRaw: "29100000000000",
        valueUnitQid: "Q4917",
        pointInTime: "2024-06-01T00:00:00Z",
        pointInTimePrecision: 10,
        rank: "normal",
        refStatedInQid: "Q21540096",
        refStatedInLabel: "World Bank",
        refUrl: undefined,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Wikidata request attempts time out and retain the bounded retry", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (_input, init) => {
    calls++;
    return await new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      assert.ok(signal);
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      runSparql("SELECT * WHERE {}", {
        attemptTimeoutMs: 5,
        retryDelayMs: 0,
      }),
      /timed out after 5ms/,
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bare SPARQL calls retain their existing unbounded fetch behavior", async () => {
  const originalFetch = globalThis.fetch;
  let observedSignal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_input, init) => {
    observedSignal = init?.signal;
    return new Response(JSON.stringify({
      head: { vars: [] },
      results: { bindings: [] },
    }), { status: 200 });
  }) as typeof fetch;

  try {
    await runSparql("SELECT * WHERE {}");
    assert.equal(observedSignal, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
