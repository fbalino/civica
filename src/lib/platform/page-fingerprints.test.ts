import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

import { countryFingerprintQuery, globalFingerprintQuery } from "./page-fingerprints";

test("the country list uses the sitemap's publication rule, so hidden slugs retire", () => {
  const { sql } = new PgDialect().sqlToQuery(countryFingerprintQuery());
  const countryList = sql.slice(sql.indexOf("WITH j AS"), sql.indexOf("bodies AS"));
  assert.match(countryList, /FROM jurisdictions WHERE lower\(name\) <> 'none'/);
});

test("Conditions rows the country panel renders are part of the shared fingerprint", () => {
  const { sql } = new PgDialect().sqlToQuery(globalFingerprintQuery());
  for (const table of [
    "civica_conditions_calculations",
    "civica_conditions_scores",
    "civica_conditions_components",
  ]) {
    assert.match(sql, new RegExp(`FROM ${table} `), `${table} fingerprinted`);
  }
});
