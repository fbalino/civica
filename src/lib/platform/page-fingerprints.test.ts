import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

import { countryFingerprintQuery } from "./page-fingerprints";

test("the country list uses the sitemap's publication rule, so hidden slugs retire", () => {
  const { sql } = new PgDialect().sqlToQuery(countryFingerprintQuery());
  const countryList = sql.slice(sql.indexOf("WITH j AS"), sql.indexOf("bodies AS"));
  assert.match(countryList, /FROM jurisdictions WHERE lower\(name\) <> 'none'/);
});
