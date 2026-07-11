import assert from "node:assert/strict";
import test from "node:test";
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

function harness() {
  let writes = 0;
  let state: Record<string, unknown> = {};
  const db = {
    update: () => ({ set: (value: Record<string, unknown>) => ({ where: async () => { state = structuredClone(value); writes++; } }) }),
  };
  return { db: db as never, state: () => state, writes: () => writes };
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
