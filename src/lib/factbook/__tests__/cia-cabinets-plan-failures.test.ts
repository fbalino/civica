import assert from "node:assert/strict";
import test from "node:test";

import { jurisdictions, persons } from "@/lib/db/schema";
import {
  computeCabinetPlan,
  type CabinetCountryFetchResult,
} from "../cia-cabinets-sync";

const VALID_HTML = `
  <html>
    <h1>Fixture Republic</h1>
    <h2>Leaders and Cabinet Members</h2>
    <div class="last-updated"><b>Last Updated</b>: <span>7/14/2026</span></div>
    <div class="leader-info"><h4>Minister of Finance</h4><p>Jane DOE</p></div>
    <h2>Explore Foreign Governments</h2>
  </html>
`;

function readDb() {
  let reads = 0;
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            reads++;
            if (table === jurisdictions) {
              return [
                {
                  id: "11111111-1111-4111-8111-111111111111",
                  name: "Fixture Republic",
                  qid: "Q1",
                },
              ];
            }
            if (table === persons) return [];
            throw new Error("unexpected fixture table read");
          },
        }),
      }),
    }),
  };
  return { db: db as never, reads: () => reads };
}

function response(status: number, html = ""): CabinetCountryFetchResult {
  return { ok: status >= 200 && status < 300, status, html };
}

test("CIA expected 404 is nonfatal and is not retried", async () => {
  const state = readDb();
  let calls = 0;
  const plan = await computeCabinetPlan({
    db: state.db,
    slugs: ["united-states"],
    crawlDelayMs: 0,
    fetchCountryPage: async () => {
      calls++;
      return response(404);
    },
    retryWait: async () => {},
  });

  assert.equal(calls, 1);
  assert.equal(state.reads(), 0);
  assert.deepEqual(plan.failed, []);
  assert.equal(plan.stats.countriesFetchFailed, 1);
  assert.equal(plan.stats.countriesSkipped, 0);
  assert.equal(plan.countries[0].fetchStatus, 404);
});

test("CIA 503 is retried, then becomes an aggregate failure", async () => {
  const state = readDb();
  let calls = 0;
  const waits: number[] = [];
  const plan = await computeCabinetPlan({
    db: state.db,
    slugs: ["ghana"],
    crawlDelayMs: 0,
    fetchCountryPage: async () => {
      calls++;
      return response(503);
    },
    retryWait: async (delayMs) => {
      waits.push(delayMs);
    },
  });

  assert.equal(calls, 3);
  assert.deepEqual(waits, [3_000, 8_000]);
  assert.equal(state.reads(), 0);
  assert.deepEqual(plan.failed, [
    { slug: "ghana", reason: "CIA World Leaders returned HTTP 503" },
  ]);
  assert.equal(plan.stats.countriesFetchFailed, 1);
  assert.equal(plan.stats.countriesSkipped, 1);
});

test("CIA malformed HTTP 200 page becomes an aggregate schema failure", async () => {
  const state = readDb();
  const plan = await computeCabinetPlan({
    db: state.db,
    slugs: ["japan"],
    crawlDelayMs: 0,
    fetchCountryPage: async () => response(200, "<html><h1>Japan</h1></html>"),
    retryWait: async () => {},
  });

  assert.deepEqual(plan.failed, [
    {
      slug: "japan",
      reason:
        "CIA World Leaders HTTP 200 page failed the leaders-section schema",
    },
  ]);
  assert.equal(plan.stats.countriesParsed, 0);
  assert.equal(plan.stats.countriesSkipped, 1);
  assert.equal(plan.countries[0].parseFailed, true);
});

test("CIA mixed successful and failed countries retain both plan outcomes", async () => {
  const state = readDb();
  const plan = await computeCabinetPlan({
    db: state.db,
    slugs: ["uruguay", "ghana"],
    crawlDelayMs: 0,
    fetchCountryPage: async (slug) =>
      slug === "uruguay" ? response(200, VALID_HTML) : response(503),
    retryWait: async () => {},
  });

  assert.equal(plan.stats.countriesFetched, 2);
  assert.equal(plan.stats.countriesParsed, 1);
  assert.equal(plan.stats.positionsIngested, 1);
  assert.equal(plan.stats.countriesSkipped, 1);
  assert.deepEqual(plan.failed, [
    { slug: "ghana", reason: "CIA World Leaders returned HTTP 503" },
  ]);
  assert.equal(
    plan.countries.find(({ slug }) => slug === "uruguay")?.positions.length,
    1,
  );
});
