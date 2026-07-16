import assert from "node:assert/strict";
import test from "node:test";
import {
  JURISDICTION_FACT_CACHE_MAX_AGE_MS,
  readFreshCachedFieldFromRow,
} from "../api";
import { refreshJurisdictionCache } from "../cache";

const jurisdiction = { id: "11111111-1111-4111-8111-111111111111", slug: "canada" };
const resolved = {
  population_total: { canonical: { factValueNumeric: 41472081 } },
  gdp_ppp_usd_billions: { canonical: { factValueNumeric: 2490.1 } },
  area_total_km2: { canonical: { factValueNumeric: 9984670 } },
  capital: { canonical: { factValue: "Ottawa" } },
  official_languages: { canonical: { factValue: "English; French" } },
  currency_code: { canonical: { factValue: "CAD" } },
  vdem_row: { canonical: { factValue: "Liberal Democracy" } },
};

function harness(initialState: Record<string, unknown> = {}) {
  let writes = 0;
  let state: Record<string, unknown> = structuredClone(initialState);
  let affectedRows = 1;
  let writeError: Error | null = null;
  const db = {
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            if (writeError) throw writeError;
            if (affectedRows === 1) {
              state = structuredClone(value);
              writes++;
              return [{ id: jurisdiction.id }];
            }
            return [];
          },
        }),
      }),
    }),
  };
  return {
    db: db as never,
    state: () => state,
    writes: () => writes,
    setAffectedRows: (value: number) => {
      affectedRows = value;
    },
    setWriteError: (value: Error | null) => {
      writeError = value;
    },
  };
}

function canonical(value: Record<string, unknown>) {
  const copy = structuredClone(value);
  delete copy.factCacheRefreshedAt;
  return copy;
}

test("cache fixture applications converge on one canonical state", async () => {
  const state = harness();
  const options = { jurisdictions: [jurisdiction], resolveFacts: async () => resolved as never };
  await refreshJurisdictionCache(state.db, options);
  const first = canonical(state.state());
  await refreshJurisdictionCache(state.db, options);
  assert.deepEqual(canonical(state.state()), first);
  assert.equal(state.writes(), 2);
});

test("cache dry-run reports stable changes with zero writes", async () => {
  const state = harness();
  const options = { jurisdictions: [jurisdiction], resolveFacts: async () => resolved as never, dryRun: true };
  const first = await refreshJurisdictionCache(state.db, options);
  const second = await refreshJurisdictionCache(state.db, options);
  assert.deepEqual({ refreshed: first.jurisdictionsRefreshed, fields: first.fieldsWritten, errors: first.errors }, { refreshed: second.jurisdictionsRefreshed, fields: second.fieldsWritten, errors: second.errors });
  assert.equal(state.writes(), 0);
});

test("cache resolver failure is loud and writes nothing", async () => {
  const state = harness();
  const result = await refreshJurisdictionCache(state.db, { jurisdictions: [jurisdiction], resolveFacts: async () => { throw new Error("resolver contract changed"); } });
  assert.match(result.errors.join(" "), /resolver contract changed/);
  assert.equal(result.jurisdictionsRefreshed, 0);
  assert.equal(state.writes(), 0);
});

test("withdrawn canonicals clear stale fields in the same timestamped update", async () => {
  const state = harness();
  const result = await refreshJurisdictionCache(state.db, {
    jurisdictions: [jurisdiction],
    resolveFacts: async () =>
      ({
        ...resolved,
        population_total: { canonical: null },
        capital: { canonical: null },
      }) as never,
  });

  assert.equal(state.state().population, null);
  assert.equal(state.state().capital, null);
  assert.ok(state.state().factCacheRefreshedAt instanceof Date);
  assert.equal(result.fieldsWritten, 5);
  assert.equal(result.fieldsCleared, 2);
  assert.equal(result.jurisdictionsRefreshed, 1);
});

test("a zero-row update cannot advance freshness or committed counts", async () => {
  const state = harness();
  state.setAffectedRows(0);
  const result = await refreshJurisdictionCache(state.db, {
    jurisdictions: [jurisdiction],
    resolveFacts: async () => resolved as never,
  });

  assert.match(result.errors.join(" "), /expected one committed jurisdiction row/);
  assert.equal(result.jurisdictionsRefreshed, 0);
  assert.equal(result.fieldsWritten, 0);
  assert.equal(result.fieldsCleared, 0);
  assert.equal(state.writes(), 0);
});

test("a database failure cannot advance freshness or committed counts", async () => {
  const state = harness();
  state.setWriteError(new Error("seeded cache write outage"));
  const result = await refreshJurisdictionCache(state.db, {
    jurisdictions: [jurisdiction],
    resolveFacts: async () => resolved as never,
  });

  assert.match(result.errors.join(" "), /seeded cache write outage/);
  assert.equal(result.jurisdictionsRefreshed, 0);
  assert.equal(result.fieldsWritten, 0);
  assert.equal(result.fieldsCleared, 0);
  assert.equal(state.writes(), 0);
});

test("a failed refresh cannot make an expired cached value readable", async () => {
  const now = new Date("2026-07-14T12:00:00.000Z");
  const factCacheRefreshedAt = new Date(
    now.getTime() - JURISDICTION_FACT_CACHE_MAX_AGE_MS - 1,
  );
  const state = harness({ population: 41_000_000, factCacheRefreshedAt });
  state.setWriteError(new Error("seeded cache write outage"));

  const result = await refreshJurisdictionCache(state.db, {
    jurisdictions: [jurisdiction],
    resolveFacts: async () => resolved as never,
  });

  assert.match(result.errors.join(" "), /seeded cache write outage/);
  assert.deepEqual(state.state().factCacheRefreshedAt, factCacheRefreshedAt);
  assert.deepEqual(
    readFreshCachedFieldFromRow(
      state.state() as {
        population: number;
        factCacheRefreshedAt: Date;
      },
      "population_total",
      { now },
    ),
    {
      value: null,
      cacheRefreshedAt: factCacheRefreshedAt,
      state: "stale_timestamp",
    },
  );
});
