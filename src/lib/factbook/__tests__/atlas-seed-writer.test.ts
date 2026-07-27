import assert from "node:assert/strict";
import test from "node:test";

import {
  countryFactbookSections,
  countryFacts,
  jurisdictions,
  statements,
} from "@/lib/db/schema";
import type { CountryFactHistoryWriter } from "@/lib/factbook/country-fact-history-writer";
import { writeAtlasCountry } from "../atlas-seed-writer";

const input = {
  existingId: null,
  jurisdiction: {
    slug: "canada",
    name: "Canada",
    type: "sovereign_state",
    statusSourceIds: ["fixture"],
    statusReviewedAt: "2026-01-01",
    statusNote: "fixture",
  },
  sections: [
    {
      sectionName: "government",
      sectionData: { capital: "Ottawa" },
      displayOrder: 1,
    },
  ],
  facts: [
    {
      factKey: "capital",
      factGroup: "A",
      category: "government",
      factValue: "Ottawa",
    },
  ],
} as Parameters<typeof writeAtlasCountry>[1];

function harness() {
  const maps = new Map<unknown, Map<string, Record<string, unknown>>>([
    [jurisdictions, new Map()],
    [countryFactbookSections, new Map()],
    [countryFacts, new Map()],
    [statements, new Map()],
  ]);
  let writes = 0;
  const db = {
    insert: (table: unknown) => ({
      values: (value: Record<string, unknown>) => {
        const run = () => {
          const key =
            table === jurisdictions
              ? String(value.slug)
              : table === countryFactbookSections
                ? `${value.jurisdictionId}:${value.sectionName}`
                : table === countryFacts
                  ? `${value.jurisdictionId}:${value.factKey}:${value.sourceId}`
                  : String(value.subjectId);
          const row = {
            id: maps.get(table)!.get(key)?.id ?? `${String(key)}-id`,
            ...structuredClone(value),
          };
          maps.get(table)!.set(key, row);
          writes += 1;
          return row;
        };
        return {
          onConflictDoUpdate: async () => run(),
          returning: async () => [{ id: run().id }],
          then: (resolve: (value: unknown) => void) => resolve(run()),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (value: Record<string, unknown>) => ({
        where: async () => {
          const first = [...maps.get(table)!.values()][0];
          if (first) Object.assign(first, structuredClone(value));
          writes += 1;
        },
      }),
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => [...maps.get(table)!.values()].slice(0, 1),
        }),
      }),
    }),
  };
  return { db: db as never, maps, writes: () => writes };
}

const fixtureFactWriter: CountryFactHistoryWriter = async (
  database,
  write,
) => {
  const fixtureDb = database as unknown as {
    insert: (table: unknown) => {
      values: (value: Record<string, unknown>) => {
        onConflictDoUpdate: () => Promise<unknown>;
      };
    };
  };
  await fixtureDb
    .insert(countryFacts)
    .values(write.values as Record<string, unknown>)
    .onConflictDoUpdate();
};

const applyOptions = {
  atlasReleaseId: "atlas-test",
  writeFact: fixtureFactWriter,
};

function semantic(
  maps: Map<unknown, Map<string, Record<string, unknown>>>,
) {
  return [...maps.values()]
    .flatMap((map) => [...map.values()])
    .map((value) => {
      const copy = structuredClone(value);
      delete copy.updatedAt;
      delete copy.retrievedAt;
      return copy;
    });
}

test("Atlas seed fixture reruns converge without duplicate provenance", async () => {
  const state = harness();
  const firstRun = await writeAtlasCountry(state.db, input, applyOptions);
  const first = semantic(state.maps);
  await writeAtlasCountry(
    state.db,
    { ...input, existingId: firstRun.jurisdictionId },
    applyOptions,
  );
  assert.deepEqual(semantic(state.maps), first);
  for (const map of state.maps.values()) assert.equal(map.size, 1);
});

test("Atlas seed dry-run is stable and writes nothing", async () => {
  const state = harness();
  assert.deepEqual(
    await writeAtlasCountry(state.db, input, { dryRun: true }),
    await writeAtlasCountry(state.db, input, { dryRun: true }),
  );
  assert.equal(state.writes(), 0);
});

test("Atlas seed apply fails closed without a named release", async () => {
  const state = harness();
  await assert.rejects(
    writeAtlasCountry(state.db, input, {
      atlasReleaseId: "",
      writeFact: fixtureFactWriter,
    }),
    /named Atlas release/,
  );
  assert.equal(state.writes(), 0);
});

test("Atlas seed empty and duplicate fixtures fail before writes", async () => {
  const state = harness();
  await assert.rejects(
    writeAtlasCountry(state.db, { ...input, facts: [] }),
    /Malformed\/empty/,
  );
  await assert.rejects(
    writeAtlasCountry(state.db, {
      ...input,
      facts: [input.facts[0], input.facts[0]],
    }),
    /Duplicate/,
  );
  assert.equal(state.writes(), 0);
});

test("Atlas seed persists an envelope rejection instead of activating it", async () => {
  const state = harness();
  const result = await writeAtlasCountry(
    state.db,
    {
      ...input,
      facts: [
        {
          factKey: "military_expenditure_pct_gdp",
          factGroup: "B",
          category: "military",
          factValue: "prose",
          factValueNumeric: 2_010_000_000_000,
          factUnit: "% of GDP",
        },
      ],
    },
    applyOptions,
  );
  assert.equal(result.rejectedFacts, 1);
  const row = [...state.maps.get(countryFacts)!.values()][0];
  assert.equal(row.status, "rejected");
  assert.match(String(row.statusReason), /^plausibility_envelope:/);
  assert.equal(row.factValue, "prose");
});
