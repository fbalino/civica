import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildJurisdictionEntityCatalog,
  findJurisdictionEntityCandidates,
  humanReadableJurisdictionContext,
} from "./jurisdiction-entities";

const rows = [
  { id: "jur-us", name: "United States", iso2: "US", iso3: "USA", slug: "united-states" },
  { id: "jur-ca", name: "Canada", iso2: "CA", iso3: "CAN", slug: "canada" },
];

test("entity catalog and aliases are deterministic and versioned", () => {
  const first = buildJurisdictionEntityCatalog(rows);
  const second = buildJurisdictionEntityCatalog([...rows].reverse());
  assert.deepEqual(first, second);
  assert.match(first.hash, /^pulse-jurisdiction-entities\/sha256:[a-f0-9]{64}$/);
  assert.ok(first.entities.find((row) => row.iso3 === "USA")?.aliases.includes("USA"));
});

test("human-readable context names provisional and cross-border candidates without UUIDs", () => {
  const catalog = buildJurisdictionEntityCatalog(rows);
  const candidates = findJurisdictionEntityCandidates(
    "Canada challenged a United States tariff.",
    catalog,
  );
  assert.deepEqual(candidates.map((row) => row.iso3), ["CAN", "USA"]);
  const context = humanReadableJurisdictionContext({
    catalog,
    provisionalJurisdictionId: "jur-ca",
    text: "Canada challenged a United States tariff.",
  });
  assert.match(context, /Canada \(CAN\)/);
  assert.match(context, /United States \(USA\)/);
  assert.doesNotMatch(context, /jur-ca|jur-us/);
});
