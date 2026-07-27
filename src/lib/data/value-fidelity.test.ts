import assert from "node:assert/strict";
import { test } from "node:test";

import {
  selectValueFidelitySample,
  VALUE_FIDELITY_SOURCE_QUOTAS,
  wilson95,
  type FidelitySampleCandidate,
} from "./value-fidelity";

function fixtures(
  sourceId: FidelitySampleCandidate["sourceId"],
  count: number,
): FidelitySampleCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    canonicalFactId: `${sourceId}-${String(index).padStart(4, "0")}`,
    sourceId,
    category: `category-${index % 5}`,
    factGroup: ["A", "B", "C"][index % 3],
  }));
}

test("the frozen seeded sample is deterministic and meets every source quota", () => {
  const candidates = [
    ...fixtures("cia_factbook", 500),
    ...fixtures("world_bank", 400),
    ...fixtures("wikidata", 9),
  ];
  const first = selectValueFidelitySample(candidates);
  const second = selectValueFidelitySample([...candidates].reverse());
  assert.deepEqual(first, second);
  assert.equal(first.length, 300);
  for (const [sourceId, quota] of Object.entries(
    VALUE_FIDELITY_SOURCE_QUOTAS,
  )) {
    assert.equal(
      first.filter((row) => row.sourceId === sourceId).length,
      quota,
    );
  }
  assert.ok(new Set(first.map((row) => row.category)).size >= 5);
  assert.deepEqual(
    new Set(first.map((row) => row.factGroup)),
    new Set(["A", "B", "C"]),
  );
});

test("sampling fails closed when a source cannot fill its frozen quota", () => {
  assert.throws(
    () =>
      selectValueFidelitySample([
        ...fixtures("cia_factbook", 500),
        ...fixtures("world_bank", 400),
        ...fixtures("wikidata", 8),
      ]),
    /quota 9 exceeds 8 candidates/,
  );
});

test("Wilson intervals retain exact counts and bound zero observed defects", () => {
  const interval = wilson95(0, 129);
  assert.equal(interval.estimate, 0);
  assert.equal(interval.lower, 0);
  assert.ok(interval.upper > 0 && interval.upper < 0.04);
  assert.deepEqual(
    { numerator: interval.numerator, denominator: interval.denominator },
    { numerator: 0, denominator: 129 },
  );
});
