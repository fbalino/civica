import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PROVENANCE_COVERAGE_SUMMARY,
  PROVENANCE_RENDERER_CLASSES,
  PROVENANCE_SURFACE_IDS,
  findUniversalProvenanceClaims,
  hasCompleteCompactProvenance,
  validateProvenanceRendererSources,
} from "../provenance-coverage";

test("registry contains the current compact-surface renderer contracts", () => {
  assert.equal(PROVENANCE_RENDERER_CLASSES.length, 6);
  assert.equal(
    new Set(PROVENANCE_RENDERER_CLASSES.map((row) => row.id)).size,
    PROVENANCE_RENDERER_CLASSES.length,
  );
  assert.deepEqual(
    [...new Set(PROVENANCE_RENDERER_CLASSES.map((row) => row.surface))].sort(),
    [...PROVENANCE_SURFACE_IDS].sort(),
  );
});

test("complete renderers have all three linkage dimensions and no exception", () => {
  for (const row of PROVENANCE_RENDERER_CLASSES) {
    assert.ok(row.implementationPaths.length > 0, `${row.id}: paths`);
    if (hasCompleteCompactProvenance(row)) {
      assert.equal(row.exception, null, `${row.id}: exception`);
    } else {
      assert.ok(row.exception?.trim(), `${row.id}: named exception`);
    }
  }
});

test("summary is derived from the registry and explicitly not dataset-wide", () => {
  const complete = PROVENANCE_RENDERER_CLASSES.filter(
    hasCompleteCompactProvenance,
  );
  assert.equal(PROVENANCE_COVERAGE_SUMMARY.total, 6);
  assert.equal(PROVENANCE_COVERAGE_SUMMARY.complete, complete.length);
  assert.equal(PROVENANCE_COVERAGE_SUMMARY.percent, 33);
  assert.equal(PROVENANCE_COVERAGE_SUMMARY.isDatasetWide, false);
  assert.equal(PROVENANCE_COVERAGE_SUMMARY.datasetWideOwner, "DAT-005");
});

test("the complete set is rankings plus the retired embed notice", () => {
  assert.deepEqual(
    PROVENANCE_RENDERER_CLASSES.filter(hasCompleteCompactProvenance).map(
      (row) => row.id,
    ),
    [
      "rankings.metric-cell",
      "embeds.retired-index",
    ],
  );
});

test("home, Atlas, rankings, and embed marker fixtures fail closed", () => {
  const sources = Object.fromEntries(
    PROVENANCE_RENDERER_CLASSES.flatMap((row) =>
      row.implementationPaths.map((file, index) => [
        file,
        `${index === 0 ? `PROVENANCE_COVERAGE: ${row.id}` : "implementation"}`,
      ]),
    ),
  );
  // Shared files are overwritten by Object.fromEntries above, so assemble a
  // complete marker list per path exactly as real source files do.
  for (const row of PROVENANCE_RENDERER_CLASSES) {
    const file = row.implementationPaths[0];
    sources[file] = `${sources[file] ?? ""}\nPROVENANCE_COVERAGE: ${row.id}`;
  }
  assert.deepEqual(validateProvenanceRendererSources(sources), []);

  for (const surface of PROVENANCE_SURFACE_IDS) {
    const target = PROVENANCE_RENDERER_CLASSES.find(
      (row) => row.surface === surface,
    )!;
    const seeded = { ...sources };
    for (const file of target.implementationPaths) {
      seeded[file] = (seeded[file] ?? "").replaceAll(
        `PROVENANCE_COVERAGE: ${target.id}`,
        "marker removed",
      );
    }
    assert.ok(
      validateProvenanceRendererSources(seeded).some(
        (issue) =>
          issue.rendererId === target.id && issue.surface === surface,
      ),
      surface,
    );
  }
});

test("scanner rejects universal source/provenance claims", () => {
  for (const claim of [
    "Every data point carries a provenance indicator showing source and freshness.",
    "Every value traces to its source.",
    "Each data point shows its source, freshness, and license.",
    "The export contains full per-fact provenance.",
    "The system has provenance on every fact.",
    "All records retain source, vintage, and license context.",
  ]) {
    assert.ok(findUniversalProvenanceClaims(claim).length > 0, claim);
  }
});

test("scanner permits explicit non-universality and bounded coverage", () => {
  for (const claim of [
    "Civica does not claim that every value has inline provenance.",
    "Per-fact provenance appears where implemented.",
    "Supported ranking cells show source and freshness.",
    "Two of six registered compact renderer classes currently meet the contract.",
  ]) {
    assert.deepEqual(findUniversalProvenanceClaims(claim), [], claim);
  }
});
