import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  JURISDICTION_FACT_CACHE_MAX_AGE_MS,
  readFreshCachedFieldFromRow,
} from "../api";

const NOW = new Date("2026-07-14T12:00:00.000Z");
const atOffset = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

test("jurisdiction cache accepts valid string and numeric values through exactly 24 hours", () => {
  const row = {
    capital: "Ottawa",
    population: 41_472_081,
    factCacheRefreshedAt: atOffset(-JURISDICTION_FACT_CACHE_MAX_AGE_MS),
  };

  assert.deepEqual(
    readFreshCachedFieldFromRow(row, "capital", { now: NOW }),
    {
      value: "Ottawa",
      cacheRefreshedAt: row.factCacheRefreshedAt,
      state: "fresh",
    },
  );
  assert.equal(
    readFreshCachedFieldFromRow(row, "population_total", { now: NOW }).value,
    41_472_081,
  );
});

test("jurisdiction cache rejects timestamps older than 24 hours", () => {
  const factCacheRefreshedAt = atOffset(
    -JURISDICTION_FACT_CACHE_MAX_AGE_MS - 1,
  );
  assert.deepEqual(
    readFreshCachedFieldFromRow(
      { capital: "Ottawa", factCacheRefreshedAt },
      "capital",
      { now: NOW },
    ),
    {
      value: null,
      cacheRefreshedAt: factCacheRefreshedAt,
      state: "stale_timestamp",
    },
  );
});

test("jurisdiction cache rejects missing, malformed, and future timestamps", () => {
  const missing = readFreshCachedFieldFromRow(
    { capital: "Ottawa", factCacheRefreshedAt: null },
    "capital",
    { now: NOW },
  );
  assert.equal(missing.value, null);
  assert.equal(missing.state, "missing_timestamp");

  for (const factCacheRefreshedAt of [
    "2026-07-14T11:00:00.000Z",
    new Date(Number.NaN),
  ]) {
    const malformed = readFreshCachedFieldFromRow(
      { capital: "Ottawa", factCacheRefreshedAt },
      "capital",
      { now: NOW },
    );
    assert.equal(malformed.value, null);
    assert.equal(malformed.state, "invalid_timestamp");
  }

  const futureAt = atOffset(1);
  assert.deepEqual(
    readFreshCachedFieldFromRow(
      { capital: "Ottawa", factCacheRefreshedAt: futureAt },
      "capital",
      { now: NOW },
    ),
    {
      value: null,
      cacheRefreshedAt: futureAt,
      state: "future_timestamp",
    },
  );
});

test("jurisdiction cache rejects missing and invalid values even with a fresh timestamp", () => {
  assert.equal(
    readFreshCachedFieldFromRow(
      { population: null, factCacheRefreshedAt: NOW },
      "population_total",
      { now: NOW },
    ).state,
    "missing_value",
  );
  assert.equal(
    readFreshCachedFieldFromRow(
      { population: Number.NaN, factCacheRefreshedAt: NOW },
      "population_total",
      { now: NOW },
    ).state,
    "invalid_value",
  );
});

test("HomeGrid and the countries API cannot bypass the timestamp-aware reader", () => {
  const homeGrid = readFileSync(
    resolve(process.cwd(), "src/components/home/HomeGrid.tsx"),
    "utf8",
  );
  assert.match(homeGrid, /readFreshCachedFieldFromRow\(c, "capital"/);
  assert.match(
    homeGrid,
    /readFreshCachedFieldFromRow\(row, "population_total"/,
  );
  assert.doesNotMatch(homeGrid, /formatPopulation\(row\.population\)/);

  const countriesRoute = readFileSync(
    resolve(process.cwd(), "src/app/api/v1/countries/route.ts"),
    "utf8",
  );
  assert.equal(
    countriesRoute.match(
      /factCacheRefreshedAt:\s*cachedJurisdictionColumns\.factCacheRefreshedAt/g,
    )?.length,
    2,
  );
  assert.match(
    countriesRoute,
    /readFreshCachedFieldFromRow\(row, "capital"/,
  );
  assert.doesNotMatch(
    countriesRoute,
    /d\?\.(?:capital|population|gdpBillions|areaSqKm)\s*\?\?\s*country\./,
  );
});
