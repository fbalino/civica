import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCiaCapitalFact,
  canonicalCapitalFactMatches,
  canonicalCapitalSqlParameters,
  extractCiaCapital,
  retainedFactbookDateFromEpoch,
} from "./cia-capital";
import { refreshJurisdictionCache } from "./reconcile/cache";
import { getFactKey } from "./reconcile/fact-keys";
import { resolveFromRows } from "./reconcile/resolver";
import type { FactRow } from "./reconcile/types";

test("retained CIA government capital becomes a canonical Group A fact", () => {
  const fact = buildCiaCapitalFact({
    Capital: { name: { text: "  C&ocirc;te d&apos;Ivoire  " } },
  });

  assert.deepEqual(fact, {
    factKey: "capital",
    factGroup: "A",
    category: "government",
    sourceUrl: "https://github.com/factbook/factbook.json",
    factValue: "Côte d'Ivoire",
    factValueNumeric: null,
    factUnit: null,
    factYear: null,
    valueStatus: "observed",
    valueStatusReason: null,
    dataVintageYear: null,
    upstreamVintageLabel: "CIA Factbook 2026-01-frozen",
    methodologyVersion: "v0.2-beta",
    valueType: "measured",
    growthMethodology: null,
  });
});

test("CIA capital extraction stays honest about absent or malformed values", () => {
  assert.equal(extractCiaCapital({ Capital: { name: {} } }), null);
  assert.equal(extractCiaCapital({ Capital: { name: { text: "  " } } }), null);
  assert.equal(
    extractCiaCapital({ Capital: { name: { text: "[object Object]" } } }),
    null,
  );
});

test("retained UTC provenance is replay-stable across local timezones", () => {
  const retrievedAt = retainedFactbookDateFromEpoch(1_769_126_400_000);
  assert.equal(retrievedAt.toISOString(), "2026-01-23T00:00:00.000Z");
  const shared = {
    factGroup: "A",
    category: "government",
    sourceUrl: "https://github.com/factbook/factbook.json",
    factValue: "Ottawa",
    factValueNumeric: null,
    factUnit: null,
    factYear: null,
    valueStatus: "observed",
    valueStatusReason: null,
    asOf: null,
    dataVintageYear: null,
    upstreamVintageLabel: "CIA Factbook 2026-01-frozen",
    methodologyVersion: "v0.2-beta",
    sourceNote: null,
    valueType: "measured",
    growthMethodology: null,
  };
  assert.equal(
    canonicalCapitalFactMatches(
      { ...shared, retrievedAt: new Date("2026-01-23T00:00:00.000Z") },
      { ...shared, retrievedAt },
    ),
    true,
  );
  assert.deepEqual(
    canonicalCapitalSqlParameters([
      "capital",
      retrievedAt,
      229,
      null,
    ]),
    ["capital", "2026-01-23T00:00:00.000Z", 229, null],
  );
});

test("seeded CIA capital resolves canonically and survives a cache refresh", async () => {
  const fact = buildCiaCapitalFact({ Capital: { name: { text: "Ottawa" } } });
  assert.ok(fact);
  const jurisdictionId = "11111111-1111-4111-8111-111111111111";
  const row: FactRow = {
    id: "22222222-2222-4222-8222-222222222222",
    jurisdictionId,
    ...fact,
    sourceId: "cia_factbook",
    wikidataQid: null,
    wikidataPid: null,
    wikidataRank: null,
    references: null,
    valueJson: null,
    asOf: null,
    retrievedAt: "2026-01-23T00:00:00.000Z",
    status: "active",
    statusReason: null,
    sourceNote: null,
  };
  const definition = getFactKey("capital");
  assert.ok(definition);
  const resolution = resolveFromRows([row], definition, "CAN");
  assert.equal(resolution.canonical?.factValue, "Ottawa");

  let state: Record<string, unknown> = { capital: null };
  const database = {
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            state = { ...state, ...structuredClone(value) };
            return [{ id: jurisdictionId }];
          },
        }),
      }),
    }),
  };
  await refreshJurisdictionCache(database as never, {
    jurisdictions: [{ id: jurisdictionId, slug: "canada" }],
    fields: ["capital"],
    resolveFacts: async () => ({
      capital: {
        jurisdictionId,
        factKey: "capital",
        ...resolution,
        isDisputed: false,
      },
    }),
  });
  assert.equal(state.capital, "Ottawa");
});
