import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  statisticalReproducibilityErrors,
  type StatisticalAnalysisReproducibilityRecord,
  type StatisticalReproducibilityReader,
} from "./statistical-reproducibility";

const result = new TextEncoder().encode(JSON.stringify({ releaseId: "release-v1", resultSha256: "b".repeat(64) }));
const source = "const seed = 'fixture-seed';";
const reader = (): StatisticalReproducibilityReader => ({
  readBytes: (path) => {
    if (path === "result.json") return result;
    if (path === "input.json") return new TextEncoder().encode("input");
    if (path === "table.csv") return new TextEncoder().encode("table");
    if (path === "seed.ts") return new TextEncoder().encode(source);
    throw new Error("missing");
  },
  readText: (path) => path === "seed.ts" ? source : "",
  packageScripts: { "validate:fixture": "tsx scripts/validate-fixture.ts" },
});
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const record = (): StatisticalAnalysisReproducibilityRecord => ({
  id: "fixture",
  resultPath: "result.json",
  resultFileSha256: hash(new TextDecoder().decode(result)),
  resultSha256: "b".repeat(64),
  resultIdentityKey: "releaseId",
  replayCommand: "validate:fixture",
  inputArtifacts: [{ path: "input.json", sha256: hash("input") }],
  derivedArtifacts: [{ path: "table.csv", sha256: hash("table") }],
  methodArtifacts: [{ path: "seed.ts", sha256: hash(source) }],
  seeds: [{ value: "fixture-seed", sourcePath: "seed.ts" }],
  tolerance: "byte_exact",
});

test("statistical reproducibility contract accepts an exact frozen record", () => {
  assert.deepEqual(statisticalReproducibilityErrors(reader(), [record()]), []);
});

test("statistical reproducibility contract fails changed input, result, seed, or replay command", () => {
  const changedInput = { ...record(), inputArtifacts: [{ path: "input.json", sha256: "0".repeat(64) }] };
  const changedResult = { ...record(), resultSha256: "0".repeat(64) };
  const missingSeed = { ...record(), seeds: [{ value: "missing-seed", sourcePath: "seed.ts" }] };
  const changedMethod = { ...record(), methodArtifacts: [{ path: "seed.ts", sha256: "0".repeat(64) }] };
  const missingReplay = { ...record(), replayCommand: "validate:missing" };
  assert.match(statisticalReproducibilityErrors(reader(), [changedInput]).join(" "), /frozen input bytes drifted/);
  assert.match(statisticalReproducibilityErrors(reader(), [changedResult]).join(" "), /semantic result hash drifted/);
  assert.match(statisticalReproducibilityErrors(reader(), [missingSeed]).join(" "), /seed is not recorded/);
  assert.match(statisticalReproducibilityErrors(reader(), [changedMethod]).join(" "), /method code bytes drifted/);
  assert.match(statisticalReproducibilityErrors(reader(), [missingReplay]).join(" "), /replay command is missing/);
});
