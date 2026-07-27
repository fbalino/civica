import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  assertRequiredClassificationOutputs,
  finalizeClassificationFreshness,
} from "../classification-freshness";

const completeOutputs = {
  worldBank: {
    regionRowsWritten: 190,
    incomeRowsWritten: 190,
    errors: [],
  },
  vdem: { rowsWritten: 170, errors: [] },
  cia: {
    monarchyRowsWritten: 195,
    formDescriptionRowsWritten: 195,
    errors: [],
  },
};

test("successful classification assertions flush freshness exactly once", async () => {
  const calls: string[] = [];
  let flushCalls = 0;

  const stamped = await finalizeClassificationFreshness(
    () => {
      calls.push("assert-all-stages");
    },
    async () => {
      calls.push("flush");
      flushCalls++;
      return ["world_bank", "vdem", "cia_factbook"];
    },
  );

  assert.deepEqual(calls, ["assert-all-stages", "flush"]);
  assert.equal(flushCalls, 1);
  assert.deepEqual(stamped, ["world_bank", "vdem", "cia_factbook"]);
});

test("a failed classification stage assertion never flushes freshness", async () => {
  let flushCalls = 0;

  await assert.rejects(
    finalizeClassificationFreshness(
      () => {
        throw new Error("factbook.classifications.vdem reported 1 error");
      },
      async () => {
        flushCalls++;
        return ["must-not-stamp"];
      },
    ),
    /classifications\.vdem reported 1 error/,
  );

  assert.equal(flushCalls, 0);
});

test("every required classification component must produce usable output", () => {
  assert.doesNotThrow(() =>
    assertRequiredClassificationOutputs(completeOutputs),
  );

  const missingComponents = [
    ["worldBank", "regionRowsWritten", /world-bank\.region produced zero/],
    ["worldBank", "incomeRowsWritten", /world-bank\.income produced zero/],
    ["vdem", "rowsWritten", /classifications\.vdem produced zero/],
    ["cia", "monarchyRowsWritten", /cia\.monarchy produced zero/],
    ["cia", "formDescriptionRowsWritten", /cia\.government-form produced zero/],
  ] as const;

  for (const [stage, field, expected] of missingComponents) {
    const fixture = structuredClone(completeOutputs);
    (fixture[stage] as Record<string, number | string[]>)[field] = 0;
    assert.throws(() => assertRequiredClassificationOutputs(fixture), expected);
  }
});

test("a healthy sibling cannot flush freshness for a missing classification component", async () => {
  let flushCalls = 0;
  await assert.rejects(
    finalizeClassificationFreshness(
      () =>
        assertRequiredClassificationOutputs({
          ...completeOutputs,
          worldBank: {
            ...completeOutputs.worldBank,
            incomeRowsWritten: 0,
          },
        }),
      async () => {
        flushCalls++;
        return ["world_bank"];
      },
    ),
    /world-bank\.income produced zero/,
  );
  assert.equal(flushCalls, 0);
});

test("the classifications cron captures all three stages and exposes one post-assertion flush", () => {
  const route = readFileSync(
    path.join(
      process.cwd(),
      "src/app/api/cron/factbook/sync-classifications/route.ts",
    ),
    "utf8",
  );

  assert.equal(
    route.match(/markSynced: freshness\.capture/g)?.length,
    3,
    "every classification stage must use the same deferred capture callback",
  );
  assert.equal(
    route.match(/assertRequiredClassificationOutputs\(/g)?.length,
    1,
    "the aggregate must assert every required classification output",
  );
  assert.equal(
    route.match(/freshness\.flush\(/g)?.length,
    1,
    "the aggregate must expose exactly one freshness flush",
  );
  assert.ok(
    route.indexOf("freshness.flush(") >
      route.lastIndexOf("assertRequiredClassificationOutputs("),
    "freshness must flush only after all stage assertions",
  );
});
